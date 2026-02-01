import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { applyEdits, modify, parse as parseJsonc } from "jsonc-parser"
import * as YAML from "yaml"
import {
	type ClientDefinition,
	getClientConfiguration,
} from "../config/clients.js"
import type {
	ConfiguredServer,
	MCPConfig,
	StreamableHTTPConnection,
} from "../types/registry.js"
import type { TransportType } from "../utils/install/transport.js"
import { verbose } from "./logger.js"

export interface ClientMCPConfig extends MCPConfig {
	[key: string]: unknown
}

/**
 * Convert client-specific server config to standard format.
 * Works directly with ClientDefinition - no intermediate descriptor needed.
 */
export function fromClientFormat(
	config: Record<string, unknown> | null,
	client: ClientDefinition,
): Record<string, unknown> | null {
	if (!config || typeof config !== "object") {
		return config
	}

	const stdio = client.transports.stdio
	const http = client.transports.http
	const mappings = client.format?.fieldMappings

	// Detect HTTP by type value or known HTTP types
	const configType = config.type
	const httpTypeValue = http?.typeValue ?? "http"
	const stdioTypeValue = stdio?.typeValue

	let isHTTP = false
	if (
		configType === "http" ||
		configType === "streamableHttp" ||
		configType === "remote" ||
		configType === httpTypeValue
	) {
		isHTTP = true
	} else if (
		configType === "local" ||
		configType === "stdio" ||
		(stdioTypeValue && configType === stdioTypeValue)
	) {
		isHTTP = false
	} else {
		// Fallback: check for URL field presence
		const urlKey = mappings?.url ?? "url"
		const cmdKey = mappings?.command ?? "command"
		isHTTP = urlKey in config && !(cmdKey in config)
	}

	const result: Record<string, unknown> = {}

	if (isHTTP) {
		result.type = "http"
		const urlKey = mappings?.url ?? "url"
		if (urlKey in config) {
			result.url = config[urlKey]
		}
		if (config.headers) {
			result.headers = config.headers
		}
		if (config.oauth) {
			result.oauth = config.oauth
		}
	} else {
		// STDIO
		const cmdKey = mappings?.command ?? "command"
		const envKey = mappings?.env ?? "env"
		const isArrayFormat = stdio?.commandFormat === "array"

		if (cmdKey in config) {
			if (isArrayFormat && Array.isArray(config[cmdKey])) {
				const arr = config[cmdKey] as string[]
				result.command = arr[0]
				if (arr.length > 1) {
					result.args = arr.slice(1)
				}
			} else {
				result.command = config[cmdKey]
			}
		}

		// args (only if not set from array format)
		if (!result.args && Array.isArray(config.args)) {
			result.args = config.args
		}

		// env (only include if non-empty)
		const envValue = config[envKey]
		if (
			envValue &&
			typeof envValue === "object" &&
			Object.keys(envValue).length > 0
		) {
			result.env = envValue
		}
	}

	return result
}

/**
 * Convert standard server config to client-specific format.
 * Works directly with ClientDefinition - no intermediate descriptor needed.
 */
export function toClientFormat(
	config: Record<string, unknown> | null,
	client: ClientDefinition,
): Record<string, unknown> | null {
	if (!config || typeof config !== "object") {
		return config
	}

	const stdio = client.transports.stdio
	const http = client.transports.http
	const mappings = client.format?.fieldMappings
	const result: Record<string, unknown> = {}

	const isHTTP =
		"type" in config &&
		(config.type === "http" || config.type === "streamableHttp")

	if (isHTTP) {
		// HTTP: apply type value and url mapping
		result.type = http?.typeValue ?? "http"
		const urlKey = mappings?.url ?? "url"
		if ("url" in config) {
			result[urlKey] = config.url
		}
		if (config.headers) {
			result.headers = config.headers
		}
		if (config.oauth) {
			result.oauth = config.oauth
		}
	} else {
		// STDIO
		const hasStdioFields =
			"command" in config || "args" in config || "env" in config

		// Type value (only if defined and has stdio fields)
		if (hasStdioFields && stdio?.typeValue !== undefined) {
			result.type = stdio.typeValue
		}

		// Command (string vs array format)
		const cmdKey = mappings?.command ?? "command"
		if ("command" in config) {
			if (stdio?.commandFormat === "array") {
				const arr = [config.command]
				if (Array.isArray(config.args) && config.args.length > 0) {
					arr.push(...config.args)
				}
				result[cmdKey] = arr
			} else {
				result[cmdKey] = config.command
			}
		}

		// Args (only for string format)
		if (
			stdio?.commandFormat !== "array" &&
			Array.isArray(config.args) &&
			config.args.length > 0
		) {
			result.args = config.args
		}

		// Env (only include if non-empty)
		const envKey = mappings?.env ?? "env"
		if (
			config.env &&
			typeof config.env === "object" &&
			Object.keys(config.env).length > 0
		) {
			result[envKey] = config.env
		}
	}

	return result
}

export function readConfig(client: string): ClientMCPConfig {
	verbose(`Reading config for client: ${client}`)
	try {
		const clientConfig = getClientConfiguration(client)

		// Command-based installers (i.e. VS Code) do not currently support listing servers
		if (clientConfig.install.method === "command") {
			return { mcpServers: {} }
		}

		const configPath = clientConfig.install.path
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
		let rawConfig: Record<string, unknown> = {}

		const format = clientConfig.install.format
		if (configPath.endsWith(".jsonc") || format === "jsonc") {
			rawConfig =
				parseJsonc(fileContent, [], { allowTrailingComma: true }) || {}
		} else if (format === "yaml") {
			const parsed = YAML.parse(fileContent)
			rawConfig =
				(parsed &&
					typeof parsed === "object" &&
					!Array.isArray(parsed) &&
					(parsed as Record<string, unknown>)) ||
				{}
		} else {
			rawConfig = JSON.parse(fileContent) as Record<string, unknown>
		}

		verbose(`Config loaded successfully: ${JSON.stringify(rawConfig, null, 2)}`)

		// Determine top-level key from client format
		const topLevelKey = clientConfig.format?.topLevelKey ?? "mcpServers"

		// Extract MCP servers from config using the appropriate top-level key
		let mcpServers: Record<string, ConfiguredServer> =
			(rawConfig[topLevelKey] as Record<string, ConfiguredServer>) ||
			(rawConfig.mcpServers as Record<string, ConfiguredServer>) ||
			{}

		// Check if transformation is needed (custom format or non-standard transports)
		const needsTransform =
			topLevelKey !== "mcpServers" ||
			clientConfig.format?.fieldMappings ||
			clientConfig.transports.stdio?.typeValue !== undefined ||
			clientConfig.transports.stdio?.commandFormat === "array" ||
			clientConfig.transports.http?.typeValue !== undefined

		if (needsTransform) {
			const transformedServers: Record<string, ConfiguredServer> = {}
			for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
				if (
					serverConfig &&
					typeof serverConfig === "object" &&
					!Array.isArray(serverConfig)
				) {
					const transformed = fromClientFormat(
						serverConfig as Record<string, unknown>,
						clientConfig,
					)
					if (transformed !== null) {
						transformedServers[serverName] = transformed as ConfiguredServer
					}
				}
			}
			mcpServers = transformedServers
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
	if (clientConfig.install.method === "command") {
		throw new Error(`Cannot write config for command-based client: ${client}`)
	}

	const format = clientConfig.install.format
	if (format === "jsonc") {
		writeConfigJsonc(config, clientConfig)
	} else if (format === "yaml") {
		writeConfigYaml(config, clientConfig)
	} else {
		writeConfigJson(config, clientConfig)
	}
}

export function runConfigCommand(
	config: ClientMCPConfig,
	clientConfig: ClientDefinition,
): void {
	if (clientConfig.install.method !== "command") {
		throw new Error(
			`Client ${clientConfig.label} does not use command-based installation`,
		)
	}

	const command = clientConfig.install.command
	const templates = clientConfig.install.templates

	// Process each server
	for (const [name, server] of Object.entries(config.mcpServers)) {
		let args: string[]

		// Determine if this is an HTTP server configuration (check both "http" and "streamableHttp")
		const isHTTPServer =
			"type" in server &&
			(server.type === "http" || server.type === "streamableHttp")

		if (isHTTPServer && templates.http) {
			// Extract URL from server config
			const serverRecord = server as Record<string, unknown>
			const serverUrl = serverRecord.url

			if (serverUrl) {
				// Use HTTP template function
				args = templates.http(name, serverUrl as string)
			} else {
				throw new Error(`HTTP server configuration missing URL`)
			}
		} else if (!isHTTPServer && "command" in server && templates.stdio) {
			// Use STDIO template function
			const serverCommand = server.command as string
			const serverArgs =
				"args" in server && Array.isArray(server.args)
					? (server.args as string[])
					: []
			args = templates.stdio(name, serverCommand, serverArgs)
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
	clientConfig: ClientDefinition,
): void {
	if (clientConfig.install.method !== "file") {
		throw new Error(
			`Client ${clientConfig.label} does not use file-based installation`,
		)
	}

	const configPath = clientConfig.install.path

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

	// Determine top-level key from client format
	const topLevelKey = clientConfig.format?.topLevelKey ?? "mcpServers"

	// Transform standard format to client-specific format
	const transformedServers: Record<string, Record<string, unknown>> = {}
	if (mergedConfig.mcpServers) {
		for (const [serverName, serverConfig] of Object.entries(
			mergedConfig.mcpServers,
		)) {
			const transformed = toClientFormat(serverConfig, clientConfig)
			if (transformed !== null) {
				transformedServers[serverName] = transformed
			}
		}
	}

	// Merge with existing config, preserving other fields
	// Remove mcpServers if it's different from topLevelKey to avoid duplication
	const { mcpServers: _, ...otherFields } = mergedConfig
	const finalConfig = {
		...otherFields,
		[topLevelKey]: transformedServers,
	}

	verbose(`Merged config: ${JSON.stringify(finalConfig, null, 2)}`)

	verbose(`Writing config to file: ${configPath}`)
	fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2))
	verbose(`Config successfully written`)
}

function writeConfigJsonc(
	config: ClientMCPConfig,
	clientConfig: ClientDefinition,
): void {
	if (clientConfig.install.method !== "file") {
		throw new Error(
			`Client ${clientConfig.label} does not use file-based installation`,
		)
	}

	const configPath = clientConfig.install.path

	const configDir = path.dirname(configPath)

	verbose(`Ensuring config directory exists: ${configDir}`)
	if (!fs.existsSync(configDir)) {
		verbose(`Creating directory: ${configDir}`)
		fs.mkdirSync(configDir, { recursive: true })
	}

	// Read existing content or start with empty object
	let content = "{}"
	if (fs.existsSync(configPath)) {
		content = fs.readFileSync(configPath, "utf8")
	}

	const topLevelKey = clientConfig.format?.topLevelKey ?? "mcpServers"

	// Parse existing config to find servers that need to be removed
	const existingConfig = parseJsonc(content) as Record<string, unknown>
	const existingServers = existingConfig[topLevelKey] as
		| Record<string, unknown>
		| undefined
	const newServerNames = new Set(Object.keys(config.mcpServers))

	// Remove servers that exist in file but not in new config
	if (existingServers) {
		for (const serverName of Object.keys(existingServers)) {
			if (!newServerNames.has(serverName)) {
				verbose(`Removing server: ${serverName}`)
				const edits = modify(content, [topLevelKey, serverName], undefined, {
					formattingOptions: { tabSize: 2, insertSpaces: true },
				})
				content = applyEdits(content, edits)
			}
		}
	}

	// Transform and apply each server config using modify() to preserve comments
	for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
		const transformed = toClientFormat(serverConfig, clientConfig)
		if (transformed !== null) {
			verbose(`Adding/updating server: ${serverName}`)
			const edits = modify(content, [topLevelKey, serverName], transformed, {
				formattingOptions: { tabSize: 2, insertSpaces: true },
			})
			content = applyEdits(content, edits)
		}
	}

	verbose(`Writing JSONC config to file: ${configPath}`)
	fs.writeFileSync(configPath, content)
	verbose(`JSONC config successfully written`)
}

function writeConfigYaml(
	config: ClientMCPConfig,
	clientConfig: ClientDefinition,
): void {
	if (clientConfig.install.method !== "file") {
		throw new Error(
			`Client ${clientConfig.label} does not use file-based installation`,
		)
	}

	const configPath = clientConfig.install.path

	const configDir = path.dirname(configPath)

	verbose(`Ensuring config directory exists: ${configDir}`)
	if (!fs.existsSync(configDir)) {
		verbose(`Creating directory: ${configDir}`)
		fs.mkdirSync(configDir, { recursive: true })
	}

	let originalDoc: ReturnType<typeof YAML.parseDocument> | null = null

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

	// Determine the YAML key from client format
	const yamlKey = clientConfig.format?.topLevelKey ?? "mcpServers"

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

				// Transform standard format to client-specific format
				const transformedConfig = toClientFormat(serverConfig, clientConfig)

				if (transformedConfig === null) {
					verbose(`Skipping server ${serverName} due to null transformation`)
					continue
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
		const transformedServers: Record<string, Record<string, unknown>> = {}
		if (config.mcpServers) {
			for (const [serverName, serverConfig] of Object.entries(
				config.mcpServers,
			)) {
				const transformed = toClientFormat(serverConfig, clientConfig)
				if (transformed !== null) {
					transformedServers[serverName] = transformed
				}
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

// ============================================================================
// Server Config Creation
// ============================================================================

/**
 * Creates HTTP server configuration for clients that support OAuth
 */
function createHTTPServerConfig(
	qualifiedName: string,
): StreamableHTTPConnection {
	return {
		type: "http",
		url: `https://server.smithery.ai/${qualifiedName}/mcp`,
		headers: {},
	}
}

/**
 * Creates STDIO configuration using mcp-remote for HTTP servers with non-OAuth clients
 */
function createMcpRemoteConfig(qualifiedName: string): ConfiguredServer {
	const url = `https://server.smithery.ai/${qualifiedName}/mcp`
	const args = ["-y", "mcp-remote", url]

	if (process.platform === "win32") {
		return { command: "cmd", args: ["/c", "npx", ...args] }
	}
	return { command: "npx", args }
}

/**
 * Creates STDIO configuration for standard server execution
 */
function createStdioConfig(qualifiedName: string): ConfiguredServer {
	const npxArgs = ["-y", "@smithery/cli@latest", "run", qualifiedName]

	if (process.platform === "win32") {
		return { command: "cmd", args: ["/c", "npx", ...npxArgs] }
	}
	return { command: "npx", args: npxArgs }
}

/**
 * Creates server configuration for the given transport type
 */
export function formatServerConfig(
	qualifiedName: string,
	transportType: TransportType,
): ConfiguredServer {
	switch (transportType) {
		case "http-oauth":
			return createHTTPServerConfig(qualifiedName)
		case "http-proxy":
			return createMcpRemoteConfig(qualifiedName)
		case "stdio":
			return createStdioConfig(qualifiedName)
	}
}
