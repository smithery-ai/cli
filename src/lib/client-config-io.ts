import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { parse as parseToml, stringify as stringifyToml } from "smol-toml"
import * as YAML from "yaml"
import {
	type ClientConfiguration,
	getClientConfiguration,
} from "../config/clients.js"
import {
	type FormatDescriptor,
	getFormatDescriptor,
} from "../config/format-descriptors.js"
import type { MCPConfig } from "../types/registry.js"
import { verbose } from "./logger.js"

export interface ClientMCPConfig extends MCPConfig {
	[key: string]: any
}

/**
 * Transforms client-specific format to standard format using format descriptor
 * @param clientConfig - The client-specific server configuration
 * @param descriptor - The format descriptor
 * @returns Standard format server configuration
 */
export function transformToStandard(
	clientConfig: any,
	descriptor: FormatDescriptor,
): any {
	if (!clientConfig || typeof clientConfig !== "object") {
		return clientConfig
	}

	const standard: any = {}

	// Determine if this is an HTTP config
	const httpTypeValue = descriptor.typeTransformations?.http?.typeValue
	const stdioTypeValue = descriptor.typeTransformations?.stdio?.typeValue
	const configType = clientConfig.type

	// Check for known HTTP types
	let isHTTP = false
	if (
		configType === "http" ||
		configType === "streamableHttp" ||
		configType === "remote" ||
		(httpTypeValue && configType === httpTypeValue)
	) {
		isHTTP = true
	} else if (
		configType === "local" ||
		configType === "stdio" ||
		(stdioTypeValue && configType === stdioTypeValue)
	) {
		isHTTP = false
	} else {
		// Fallback: check for URL field presence (HTTP) vs command field (STDIO)
		const urlKey = descriptor.fieldMappings?.http?.url || "url"
		const commandKey = descriptor.fieldMappings?.stdio?.command || "command"
		isHTTP = urlKey in clientConfig && !(commandKey in clientConfig)
	}

	if (isHTTP) {
		// HTTP config transformation
		standard.type = "http"

		// Map URL field
		const urlKey = descriptor.fieldMappings?.http?.url || "url"
		if (urlKey in clientConfig) {
			standard.url = clientConfig[urlKey]
		}

		// Map headers field
		const headersKey = descriptor.fieldMappings?.http?.headers || "headers"
		if (headersKey in clientConfig && clientConfig[headersKey]) {
			standard.headers = clientConfig[headersKey]
		}

		// Map oauth field
		const oauthKey = descriptor.fieldMappings?.http?.oauth || "oauth"
		if (oauthKey in clientConfig && clientConfig[oauthKey]) {
			standard.oauth = clientConfig[oauthKey]
		}
	} else {
		// STDIO config transformation
		// Standard format doesn't have a type field for STDIO

		// Handle command format (string vs array)
		const commandFormat =
			descriptor.structureTransformations?.stdio?.commandFormat || "string"
		const commandKey = descriptor.fieldMappings?.stdio?.command || "command"

		if (commandKey in clientConfig) {
			if (
				commandFormat === "array" &&
				Array.isArray(clientConfig[commandKey])
			) {
				// Array format: first element is command, rest are args
				const commandArray = clientConfig[commandKey]
				if (commandArray.length > 0) {
					standard.command = commandArray[0]
					if (commandArray.length > 1) {
						standard.args = commandArray.slice(1)
					}
				}
			} else {
				// String format: command is a string
				standard.command = clientConfig[commandKey]
			}
		}

		// Map args field (only if not already set from array format)
		if (!standard.args) {
			const argsKey = descriptor.fieldMappings?.stdio?.args || "args"
			if (argsKey in clientConfig && Array.isArray(clientConfig[argsKey])) {
				standard.args = clientConfig[argsKey]
			}
		}

		// Map env field
		const envKey = descriptor.fieldMappings?.stdio?.env || "env"
		if (
			envKey in clientConfig &&
			clientConfig[envKey] &&
			Object.keys(clientConfig[envKey]).length > 0
		) {
			standard.env = clientConfig[envKey]
		}
	}

	return standard
}

/**
 * Transforms standard format to client-specific format using format descriptor
 * @param standardConfig - The standard format server configuration
 * @param descriptor - The format descriptor
 * @param serverName - The server name (used for metadata generation)
 * @returns Client-specific format server configuration
 */
export function transformFromStandard(
	standardConfig: any,
	descriptor: FormatDescriptor,
	_serverName: string,
): any {
	if (!standardConfig || typeof standardConfig !== "object") {
		return standardConfig
	}

	const client: any = {}

	// Determine if this is an HTTP config
	const isHTTP =
		"type" in standardConfig &&
		(standardConfig.type === "http" || standardConfig.type === "streamableHttp")

	if (isHTTP) {
		// HTTP config transformation
		const httpTypeValue =
			descriptor.typeTransformations?.http?.typeValue || "http"
		client.type = httpTypeValue

		// Map URL field
		const urlKey = descriptor.fieldMappings?.http?.url || "url"
		if ("url" in standardConfig) {
			client[urlKey] = standardConfig.url
		}

		// Map headers field
		const headersKey = descriptor.fieldMappings?.http?.headers || "headers"
		if ("headers" in standardConfig && standardConfig.headers) {
			client[headersKey] = standardConfig.headers
		}

		// Map oauth field
		const oauthKey = descriptor.fieldMappings?.http?.oauth || "oauth"
		if ("oauth" in standardConfig && standardConfig.oauth) {
			client[oauthKey] = standardConfig.oauth
		}
	} else {
		// STDIO config transformation
		// Only add type if there are actual STDIO fields
		const hasStdioFields =
			"command" in standardConfig ||
			"args" in standardConfig ||
			"env" in standardConfig
		const stdioTypeValue = descriptor.typeTransformations?.stdio?.typeValue
		if (
			hasStdioFields &&
			stdioTypeValue !== null &&
			stdioTypeValue !== undefined
		) {
			client.type = stdioTypeValue
		}

		// Handle command format (string vs array)
		const commandFormat =
			descriptor.structureTransformations?.stdio?.commandFormat || "string"
		const commandKey = descriptor.fieldMappings?.stdio?.command || "command"

		if ("command" in standardConfig) {
			if (commandFormat === "array") {
				// Array format: combine command and args into single array
				const commandArray = [standardConfig.command]
				if (
					"args" in standardConfig &&
					Array.isArray(standardConfig.args) &&
					standardConfig.args.length > 0
				) {
					commandArray.push(...standardConfig.args)
				}
				client[commandKey] = commandArray
			} else {
				// String format: command is a string
				client[commandKey] = standardConfig.command
			}
		}

		// Map args field (only if not using array format)
		if (commandFormat !== "array") {
			const argsKey = descriptor.fieldMappings?.stdio?.args || "args"
			if (
				"args" in standardConfig &&
				Array.isArray(standardConfig.args) &&
				standardConfig.args.length > 0
			) {
				client[argsKey] = standardConfig.args
			}
		}

		// Map env field
		const envKey = descriptor.fieldMappings?.stdio?.env || "env"
		if ("env" in standardConfig && standardConfig.env) {
			client[envKey] = standardConfig.env
		}
	}

	return client
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

		// Get format descriptor
		const descriptor = clientConfig.formatDescriptor
			? getFormatDescriptor(clientConfig.formatDescriptor)
			: getFormatDescriptor(client)

		// Determine top-level key to use
		let topLevelKey = descriptor.topLevelKey
		if (clientConfig.installType === "toml") {
			// TOML format uses mcp_servers (underscore) instead of mcpServers (camelCase)
			topLevelKey = "mcp_servers"
		} else if (
			clientConfig.installType === "yaml" &&
			clientConfig.yamlKey &&
			clientConfig.yamlKey !== "mcpServers"
		) {
			// Legacy YAML key override
			topLevelKey = clientConfig.yamlKey
		}

		// Extract MCP servers from config using the appropriate top-level key
		let mcpServers = rawConfig[topLevelKey] || rawConfig.mcpServers || {}

		// Transform client-specific format to standard format if needed
		// (if using custom top-level key or if descriptor has custom mappings)
		if (
			topLevelKey !== "mcpServers" ||
			descriptor.fieldMappings ||
			descriptor.typeTransformations ||
			descriptor.structureTransformations
		) {
			const transformedServers: Record<string, any> = {}
			for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
				transformedServers[serverName] = transformToStandard(
					serverConfig,
					descriptor,
				)
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

	// Get format descriptor
	const descriptor = clientConfig.formatDescriptor
		? getFormatDescriptor(clientConfig.formatDescriptor)
		: getFormatDescriptor(clientConfig.label.toLowerCase())

	// Determine top-level key to use
	const topLevelKey = descriptor.topLevelKey

	// Transform standard format to client-specific format
	const transformedServers: Record<string, any> = {}
	if (mergedConfig.mcpServers) {
		for (const [serverName, serverConfig] of Object.entries(
			mergedConfig.mcpServers,
		)) {
			transformedServers[serverName] = transformFromStandard(
				serverConfig,
				descriptor,
				serverName,
			)
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

	// Get format descriptor
	const descriptor = clientConfig.formatDescriptor
		? getFormatDescriptor(clientConfig.formatDescriptor)
		: getFormatDescriptor(clientConfig.label.toLowerCase())

	// Determine the YAML key to use
	const yamlKey = clientConfig.yamlKey || descriptor.topLevelKey || "mcpServers"

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
				const transformedConfig = transformFromStandard(
					serverConfig,
					descriptor,
					serverName,
				)

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
		// Transform standard format to client-specific format
		const transformedServers: Record<string, any> = {}
		if (config.mcpServers) {
			for (const [serverName, serverConfig] of Object.entries(
				config.mcpServers,
			)) {
				transformedServers[serverName] = transformFromStandard(
					serverConfig,
					descriptor,
					serverName,
				)
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

	// Get format descriptor (TOML always uses mcp_servers key)
	const descriptor = getFormatDescriptor(clientConfig.label.toLowerCase())
	// Override top-level key for TOML
	const tomlDescriptor: FormatDescriptor = {
		...descriptor,
		topLevelKey: "mcp_servers",
	}

	// Transform standard format to client-specific format
	const mcpServersForToml: { [key: string]: any } = {}
	for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
		mcpServersForToml[serverName] = transformFromStandard(
			serverConfig,
			tomlDescriptor,
			serverName,
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
