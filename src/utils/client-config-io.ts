import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { parse as parseToml, stringify as stringifyToml } from "smol-toml"
import * as YAML from "yaml"
import {
	type ClientConfiguration,
	getClientConfiguration,
} from "../config/clients.js"
import { verbose } from "../lib/logger.js"
import type { MCPConfig } from "../types/registry.js"

export interface ClientMCPConfig extends MCPConfig {
	[key: string]: any
}

/**
 * Transforms HTTP server config to use custom URL key and type if specified by client
 * @param serverConfig - The server configuration object
 * @param clientConfig - The client configuration
 * @returns Transformed server configuration
 */
function transformHTTPServerConfig(
	serverConfig: any,
	clientConfig: ClientConfiguration,
): any {
	// Only transform HTTP configs (check both "http" and "streamableHttp" types)
	const isHTTPConfig =
		serverConfig.type === "http" || serverConfig.type === "streamableHttp"
	if (!isHTTPConfig) {
		return serverConfig
	}

	let transformed = { ...serverConfig }

	// Override type if specified
	if (clientConfig.httpType && clientConfig.httpType !== "http") {
		transformed.type = clientConfig.httpType
	}

	// Transform URL key if specified
	if (clientConfig.httpUrlKey && clientConfig.httpUrlKey !== "url") {
		const { url, ...rest } = transformed
		transformed = {
			...rest,
			[clientConfig.httpUrlKey]: url,
		}
	}

	return transformed
}

/**
 * Transforms goose format server config to standard format
 * @param gooseConfig - The goose format server configuration
 * @returns Standard format server configuration
 */
function transformGooseToStandard(gooseConfig: any): any {
	if (!gooseConfig || typeof gooseConfig !== "object") {
		return gooseConfig
	}

	const standard: any = {}

	// Check if this is an HTTP config
	const isHTTP =
		gooseConfig.type === "http" || gooseConfig.type === "streamableHttp"

	if (isHTTP) {
		// HTTP config: preserve type, url, headers
		standard.type = gooseConfig.type
		if ("url" in gooseConfig) {
			standard.url = gooseConfig.url
		}
		if ("headers" in gooseConfig) {
			standard.headers = gooseConfig.headers
		}
	} else {
		// STDIO config: transform cmd -> command, preserve args and env
		// Note: STDIO configs in standard format don't have a type field
		if ("cmd" in gooseConfig) {
			standard.command = gooseConfig.cmd
		}
		if (
			"args" in gooseConfig &&
			Array.isArray(gooseConfig.args) &&
			gooseConfig.args.length > 0
		) {
			standard.args = gooseConfig.args
		}
		// Transform envs -> env (only if present and not empty)
		if (
			"envs" in gooseConfig &&
			gooseConfig.envs &&
			Object.keys(gooseConfig.envs).length > 0
		) {
			standard.env = gooseConfig.envs
		}
		// Don't include type for STDIO configs in standard format
	}

	// Ignore name, enabled, timeout (write-only metadata)

	return standard
}

/**
 * Transforms standard format server config to goose format
 * @param standardConfig - The standard format server configuration
 * @param serverName - The server name (used for generating display name)
 * @returns Goose format server configuration
 */
function transformStandardToGoose(
	standardConfig: any,
	serverName: string,
): any {
	if (!standardConfig || typeof standardConfig !== "object") {
		return standardConfig
	}

	const goose: any = {}

	// Check if this is an HTTP config
	const isHTTP =
		"type" in standardConfig &&
		(standardConfig.type === "http" || standardConfig.type === "streamableHttp")

	if (isHTTP) {
		// HTTP config: preserve type, url, headers
		goose.type = standardConfig.type
		if ("url" in standardConfig) {
			goose.url = standardConfig.url
		}
		if ("headers" in standardConfig) {
			goose.headers = standardConfig.headers
		}
	} else {
		// STDIO config: transform command -> cmd, preserve args and env
		if ("command" in standardConfig) {
			goose.cmd = standardConfig.command
		}
		if (
			"args" in standardConfig &&
			Array.isArray(standardConfig.args) &&
			standardConfig.args.length > 0
		) {
			goose.args = standardConfig.args
		}
		// Transform env -> envs (only if present)
		if (
			"env" in standardConfig &&
			standardConfig.env &&
			Object.keys(standardConfig.env).length > 0
		) {
			goose.envs = standardConfig.env
		}
		// Add type for STDIO configs
		goose.type = "stdio"
	}

	// Add goose-specific fields
	// Capitalize first letter of each word
	const nameParts = serverName
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
	goose.name = nameParts.join(" ")
	goose.enabled = true
	goose.timeout = 300

	return goose
}

export function readConfig(client: string): ClientMCPConfig {
	verbose(`Reading config for client: ${client}`)
	try {
		const clientConfig = getClientConfiguration(client)

		// Command-based installers (i.e. VS Code) do not currently support listing servers
		if (clientConfig.installType === "command") {
			return { mcpServers: {} }
		}

		const configPath = clientConfig.path
		if (!configPath) {
			verbose(`No config path defined for client: ${client}`)
			return { mcpServers: {} }
		}

		verbose(`Checking if config file exists at: ${configPath}`)
		if (!fs.existsSync(configPath)) {
			verbose(`Config file not found, returning default empty config`)
			return { mcpServers: {} }
		}

		verbose(`Reading config file content`)
		const fileContent = fs.readFileSync(configPath, "utf8")
		let rawConfig: any = {}

		if (clientConfig.installType === "yaml") {
			rawConfig = (YAML.parse(fileContent) as any) || {}
		} else if (clientConfig.installType === "toml") {
			try {
				rawConfig = parseToml(fileContent) as any
				verbose(`TOML config parsed successfully`)
			} catch (tomlError) {
				verbose(
					`Error parsing TOML: ${tomlError instanceof Error ? tomlError.message : String(tomlError)}`,
				)
				throw tomlError
			}
		} else {
			rawConfig = JSON.parse(fileContent)
		}

		verbose(`Config loaded successfully: ${JSON.stringify(rawConfig, null, 2)}`)

		// Handle different naming conventions for MCP servers
		let mcpServers = rawConfig.mcpServers || {}
		if (clientConfig.installType === "toml" && rawConfig.mcp_servers) {
			// TOML format uses mcp_servers (underscore) instead of mcpServers (camelCase)
			mcpServers = rawConfig.mcp_servers
		} else if (
			clientConfig.installType === "yaml" &&
			clientConfig.yamlKey &&
			clientConfig.yamlKey !== "mcpServers" &&
			rawConfig[clientConfig.yamlKey]
		) {
			// YAML format may use custom key (e.g., "extensions" for goose)
			const rawServers = rawConfig[clientConfig.yamlKey]
			// Transform goose format to standard format
			mcpServers = {}
			for (const [serverName, serverConfig] of Object.entries(rawServers)) {
				mcpServers[serverName] = transformGooseToStandard(serverConfig)
			}
		}

		// Normalize HTTP server configs: convert custom URL keys and types back to standard format for internal consistency
		if (
			(clientConfig.httpUrlKey && clientConfig.httpUrlKey !== "url") ||
			(clientConfig.httpType && clientConfig.httpType !== "http")
		) {
			const normalizedServers: Record<string, any> = {}
			for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
				if (
					serverConfig &&
					typeof serverConfig === "object" &&
					"type" in serverConfig &&
					(serverConfig.type === "http" ||
						serverConfig.type === "streamableHttp")
				) {
					const serverConfigObj = serverConfig as any
					let normalized = { ...serverConfigObj }

					// Normalize type back to "http"
					if (
						clientConfig.httpType &&
						serverConfigObj.type === clientConfig.httpType
					) {
						normalized.type = "http"
					}

					// Normalize URL key back to "url"
					if (
						clientConfig.httpUrlKey &&
						clientConfig.httpUrlKey !== "url" &&
						clientConfig.httpUrlKey in serverConfigObj
					) {
						const { [clientConfig.httpUrlKey]: customUrl, ...rest } = normalized
						normalized = {
							...rest,
							url: customUrl,
						}
					}

					normalizedServers[serverName] = normalized
				} else {
					normalizedServers[serverName] = serverConfig
				}
			}
			mcpServers = normalizedServers
		}

		return {
			...rawConfig,
			mcpServers,
		}
	} catch (error) {
		verbose(
			`Error reading config: ${error instanceof Error ? error.stack : JSON.stringify(error)}`,
		)
		return { mcpServers: {} }
	}
}

// Writes a complete client config into client config file
export function writeConfig(config: ClientMCPConfig, client: string): void {
	verbose(`Writing config for client: ${client}`)
	verbose(`Config data: ${JSON.stringify(config, null, 2)}`)

	if (!config.mcpServers || typeof config.mcpServers !== "object") {
		verbose(`Invalid mcpServers structure in config`)
		throw new Error("Invalid mcpServers structure")
	}

	const clientConfig = getClientConfiguration(client)
	if (clientConfig.installType === "yaml") {
		writeConfigYaml(config, clientConfig)
	} else if (clientConfig.installType === "toml") {
		writeConfigToml(config, clientConfig)
	} else {
		writeConfigJson(config, clientConfig)
	}
}

export function runConfigCommand(
	config: ClientMCPConfig,
	clientConfig: ClientConfiguration,
): void {
	const command = clientConfig.command
	if (!command) {
		throw new Error(`No command defined for client: ${clientConfig.label}`)
	}

	const commandConfig = clientConfig.commandConfig
	if (!commandConfig) {
		throw new Error(
			`No command configuration defined for client: ${clientConfig.label}`,
		)
	}

	// Process each server
	for (const [name, server] of Object.entries(config.mcpServers)) {
		let args: string[]

		// Determine if this is an HTTP server configuration (check both "http" and "streamableHttp")
		const isHTTPServer =
			"type" in server &&
			(server.type === "http" || server.type === "streamableHttp")

		if (isHTTPServer && commandConfig.http) {
			// Extract URL - check for override key first, then fallback to "url"
			const urlKey = clientConfig.httpUrlKey || "url"
			const serverUrl = (server as any)[urlKey] || (server as any).url

			if (serverUrl) {
				// Use HTTP template function
				args = commandConfig.http(name, serverUrl as string)
			} else {
				throw new Error(
					`HTTP server configuration missing URL (checked keys: ${urlKey}, url)`,
				)
			}
		} else if (!isHTTPServer && "command" in server && commandConfig.stdio) {
			// Use STDIO template function
			const serverCommand = server.command as string
			const serverArgs =
				"args" in server && Array.isArray(server.args)
					? (server.args as string[])
					: []
			args = commandConfig.stdio(name, serverCommand, serverArgs)
		} else {
			const transportType = isHTTPServer ? "HTTP" : "STDIO"
			throw new Error(
				`No ${transportType} command configuration defined for client: ${clientConfig.label}`,
			)
		}

		verbose(`Running command: ${JSON.stringify([command, ...args])}`)

		try {
			const output = execFileSync(command, args)
			verbose(`Executed command successfully for ${name}: ${output.toString()}`)
		} catch (error) {
			verbose(
				`Error executing command for ${name}: ${error instanceof Error ? error.message : String(error)}`,
			)

			if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
				throw new Error(
					`Command '${command}' not found. Make sure ${command} is installed and on your PATH`,
				)
			}

			throw error
		}
	}
}

function writeConfigJson(
	config: ClientMCPConfig,
	clientConfig: ClientConfiguration,
): void {
	const configPath = clientConfig.path
	if (!configPath) {
		throw new Error(`No path defined for client: ${clientConfig.label}`)
	}

	const configDir = path.dirname(configPath)

	verbose(`Ensuring config directory exists: ${configDir}`)
	if (!fs.existsSync(configDir)) {
		verbose(`Creating directory: ${configDir}`)
		fs.mkdirSync(configDir, { recursive: true })
	}

	let existingConfig: ClientMCPConfig = { mcpServers: {} }
	try {
		if (fs.existsSync(configPath)) {
			verbose(`Reading existing config file for merging`)
			existingConfig = JSON.parse(fs.readFileSync(configPath, "utf8"))
			verbose(
				`Existing config loaded: ${JSON.stringify(existingConfig, null, 2)}`,
			)
		}
	} catch (error) {
		verbose(
			`Error reading existing config for merge: ${error instanceof Error ? error.message : String(error)}`,
		)
		// If reading fails, continue with empty existing config
	}

	verbose(`Merging configs`)
	const mergedConfig = {
		...existingConfig,
		...config,
	}

	// Transform HTTP server configs if client has httpUrlKey or httpType override
	if (
		mergedConfig.mcpServers &&
		(clientConfig.httpUrlKey || clientConfig.httpType)
	) {
		const transformedServers: Record<string, any> = {}
		for (const [serverName, serverConfig] of Object.entries(
			mergedConfig.mcpServers,
		)) {
			transformedServers[serverName] = transformHTTPServerConfig(
				serverConfig,
				clientConfig,
			)
		}
		mergedConfig.mcpServers = transformedServers
	}

	verbose(`Merged config: ${JSON.stringify(mergedConfig, null, 2)}`)

	verbose(`Writing config to file: ${configPath}`)
	fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2))
	verbose(`Config successfully written`)
}

function writeConfigYaml(
	config: ClientMCPConfig,
	clientConfig: ClientConfiguration,
): void {
	const configPath = clientConfig.path
	if (!configPath) {
		throw new Error(`No path defined for client: ${clientConfig.label}`)
	}

	const configDir = path.dirname(configPath)

	verbose(`Ensuring config directory exists: ${configDir}`)
	if (!fs.existsSync(configDir)) {
		verbose(`Creating directory: ${configDir}`)
		fs.mkdirSync(configDir, { recursive: true })
	}

	let originalDoc: any = null

	try {
		if (fs.existsSync(configPath)) {
			verbose(`Reading existing YAML config file for merging`)
			const originalContent = fs.readFileSync(configPath, "utf8")
			originalDoc = YAML.parseDocument(originalContent)
			verbose(`Original YAML document loaded successfully`)
		}
	} catch (error) {
		verbose(
			`Error reading existing YAML config for merge: ${error instanceof Error ? error.message : String(error)}`,
		)
		// If reading fails, continue with empty existing config
	}

	verbose(`Merging YAML configs`)

	// Determine the YAML key to use (defaults to "mcpServers")
	const yamlKey = clientConfig.yamlKey || "mcpServers"
	const isGooseFormat = yamlKey === "extensions"

	if (originalDoc) {
		let mcpServersNode = originalDoc.get(yamlKey)
		if (!mcpServersNode) {
			verbose(`${yamlKey} section not found, creating new section`)
			originalDoc.set(yamlKey, new YAML.YAMLMap())
			mcpServersNode = originalDoc.get(yamlKey)
		}

		if (mcpServersNode && typeof mcpServersNode.set === "function") {
			const existingServerNames = new Set<string>()
			if (mcpServersNode.items) {
				for (const item of mcpServersNode.items) {
					if (item.key?.value) {
						existingServerNames.add(item.key.value)
					}
				}
			}
			const newServerNames = new Set<string>(Object.keys(config.mcpServers))

			for (const serverName of existingServerNames) {
				if (!newServerNames.has(serverName)) {
					verbose(`Removing server: ${serverName}`)
					mcpServersNode.delete(serverName)
				}
			}

			for (const [serverName, serverConfig] of Object.entries(
				config.mcpServers,
			)) {
				verbose(`Adding/updating server: ${serverName}`)

				// Transform HTTP server config if client has httpUrlKey override
				let transformedConfig = transformHTTPServerConfig(
					serverConfig,
					clientConfig,
				)

				// Transform to goose format if needed
				if (isGooseFormat) {
					transformedConfig = transformStandardToGoose(
						transformedConfig,
						serverName,
					)
				}

				const existingServer = mcpServersNode.get(serverName)
				if (existingServer && typeof existingServer.set === "function") {
					verbose(
						`Updating existing server ${serverName} while preserving comments`,
					)
					for (const [key, value] of Object.entries(transformedConfig)) {
						existingServer.set(key, value)
					}
				} else {
					verbose(`Adding new server ${serverName}`)
					mcpServersNode.set(serverName, transformedConfig)
				}
			}
		} else {
			const nodeType = mcpServersNode ? typeof mcpServersNode : "undefined"
			throw new Error(
				`${yamlKey} section is not a proper YAML Map (found: ${nodeType}). Please ensure the YAML file has a valid ${yamlKey} section or create a new file.`,
			)
		}

		fs.writeFileSync(configPath, originalDoc.toString())
		verbose(`YAML config updated`)
	} else {
		// Create new file from scratch
		// Determine the YAML key to use (defaults to "mcpServers")
		const yamlKey = clientConfig.yamlKey || "mcpServers"
		const isGooseFormat = yamlKey === "extensions"

		// Transform HTTP server configs if client has httpUrlKey or httpType override
		const transformedServers: Record<string, any> = {}
		if (config.mcpServers) {
			for (const [serverName, serverConfig] of Object.entries(
				config.mcpServers,
			)) {
				let transformed = serverConfig
				if (clientConfig.httpUrlKey || clientConfig.httpType) {
					transformed = transformHTTPServerConfig(serverConfig, clientConfig)
				}
				if (isGooseFormat) {
					transformed = transformStandardToGoose(transformed, serverName)
				}
				transformedServers[serverName] = transformed
			}
		}
		const newConfig = { [yamlKey]: transformedServers }
		const yamlContent = YAML.stringify(newConfig, {
			indent: 2,
			lineWidth: -1,
		})
		fs.writeFileSync(configPath, yamlContent)
		verbose(`New YAML config file created`)
	}

	verbose(`YAML config successfully written`)
}

function writeConfigToml(
	config: ClientMCPConfig,
	clientConfig: ClientConfiguration,
): void {
	const configPath = clientConfig.path
	if (!configPath) {
		throw new Error(`No path defined for client: ${clientConfig.label}`)
	}

	const configDir = path.dirname(configPath)

	verbose(`Ensuring config directory exists: ${configDir}`)
	if (!fs.existsSync(configDir)) {
		verbose(`Creating directory: ${configDir}`)
		fs.mkdirSync(configDir, { recursive: true })
	}

	let existingConfig: any = {}
	try {
		if (fs.existsSync(configPath)) {
			verbose(`Reading existing TOML config file for merging`)
			const existingContent = fs.readFileSync(configPath, "utf8")
			existingConfig = parseToml(existingContent)
			verbose(`Existing TOML config loaded successfully`)
		}
	} catch (error) {
		verbose(
			`Error reading existing TOML config for merge: ${error instanceof Error ? error.message : String(error)}`,
		)
		// If reading fails, continue with empty existing config
	}

	verbose(`Merging TOML configs`)

	// Convert mcpServers to mcp_servers for Codex format
	// Transform HTTP server configs if client has httpUrlKey override
	const mcpServersForToml: { [key: string]: any } = {}
	for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
		mcpServersForToml[serverName] = transformHTTPServerConfig(
			serverConfig,
			clientConfig,
		)
	}

	const mergedConfig = {
		...existingConfig,
		mcp_servers: mcpServersForToml, // Replace entire mcp_servers section
	}

	verbose(`Merged TOML config: ${JSON.stringify(mergedConfig, null, 2)}`)

	// Convert to TOML format using smol-toml
	const tomlContent = stringifyToml(mergedConfig)

	verbose(`Writing TOML config to file: ${configPath}`)
	fs.writeFileSync(configPath, tomlContent)
	verbose(`TOML config successfully written`)
}
