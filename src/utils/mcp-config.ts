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
import type { ConfiguredServer, MCPConfig } from "../types/registry.js"

export interface ClientMCPConfig extends MCPConfig {
	[key: string]: any
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toStringRecord(
	value: unknown,
): Record<string, string> | undefined {
	if (!isPlainObject(value)) return undefined
	const out: Record<string, string> = {}
	for (const [k, v] of Object.entries(value)) {
		if (typeof v === "string") out[k] = v
	}
	return Object.keys(out).length > 0 ? out : undefined
}

function coerceConfiguredServer(entry: unknown): ConfiguredServer | undefined {
	if (!isPlainObject(entry)) return undefined

	// Streamable HTTP connection
	if (entry.type === "http" && typeof entry.url === "string") {
		const headers = toStringRecord(entry.headers)
		return {
			type: "http",
			url: entry.url,
			...(headers ? { headers } : {}),
		}
	}

	// STDIO connection
	if (typeof entry.command === "string") {
		const args =
			Array.isArray(entry.args) && entry.args.every((a) => typeof a === "string")
				? (entry.args as string[])
				: undefined
		const env = toStringRecord(entry.env)
		return {
			command: entry.command,
			...(args && args.length > 0 ? { args } : {}),
			...(env ? { env } : {}),
		}
	}

	return undefined
}

export function readConfig(client: string): ClientMCPConfig {
	verbose(`Reading config for client: ${client}`)
	try {
		const normalizedClientName = client.toLowerCase()
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
		let mcpServers: Record<string, ConfiguredServer> = rawConfig.mcpServers || {}

		// OpenCode stores MCP servers under "mcp" with a different schema.
		if (normalizedClientName === "opencode") {
			const converted: Record<string, ConfiguredServer> = {}

			// Preferred source of truth: OpenCode's "mcp" field.
			if (isPlainObject(rawConfig.mcp)) {
				for (const [name, entry] of Object.entries(rawConfig.mcp)) {
					if (!isPlainObject(entry) || typeof entry.type !== "string") continue

					if (entry.type === "local" && Array.isArray(entry.command)) {
						const cmdParts = entry.command.filter(
							(p): p is string => typeof p === "string",
						)
						if (cmdParts.length === 0) continue

						const [command, ...args] = cmdParts
						const env = toStringRecord(entry.environment)
						converted[name] = {
							command,
							...(args.length > 0 ? { args } : {}),
							...(env ? { env } : {}),
						}
					}

					if (entry.type === "remote" && typeof entry.url === "string") {
						const headers = toStringRecord(entry.headers)
						converted[name] = {
							type: "http",
							url: entry.url,
							...(headers ? { headers } : {}),
						}
					}
				}
			}

			// Migration path: if a buggy top-level "mcpServers" exists, include those too.
			if (isPlainObject(rawConfig.mcpServers)) {
				for (const [name, entry] of Object.entries(rawConfig.mcpServers)) {
					if (name in converted) continue
					const coerced = coerceConfiguredServer(entry)
					if (coerced) converted[name] = coerced
				}
			}

			mcpServers = converted
		}

		if (clientConfig.installType === "toml" && rawConfig.mcp_servers) {
			// Codex uses mcp_servers (underscore) instead of mcpServers (camelCase)
			mcpServers = rawConfig.mcp_servers
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
	if (client.toLowerCase() === "opencode") {
		writeConfigOpenCodeJson(config, clientConfig)
		return
	}
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

		// Determine if this is an HTTP server configuration
		const isHTTPServer = "type" in server && server.type === "http"

		if (isHTTPServer && "url" in server && commandConfig.http) {
			// Use HTTP template function
			args = commandConfig.http(name, server.url as string)
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
	verbose(`Merged config: ${JSON.stringify(mergedConfig, null, 2)}`)

	verbose(`Writing config to file: ${configPath}`)
	fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2))
	verbose(`Config successfully written`)
}

function writeConfigOpenCodeJson(
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

	let existingConfig: Record<string, unknown> = {}
	try {
		if (fs.existsSync(configPath)) {
			verbose(`Reading existing OpenCode config file for merging`)
			existingConfig = JSON.parse(fs.readFileSync(configPath, "utf8"))
		}
	} catch (error) {
		verbose(
			`Error reading existing OpenCode config for merge: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	const existingMcp = isPlainObject(existingConfig.mcp)
		? (existingConfig.mcp as Record<string, unknown>)
		: {}

	const nextMcp: Record<string, unknown> = { ...existingMcp }

	// Remove servers we know how to manage, but that are no longer present.
	for (const [name, entry] of Object.entries(existingMcp)) {
		if (!isPlainObject(entry) || typeof entry.type !== "string") continue
		if (entry.type !== "local" && entry.type !== "remote") continue
		if (!(name in config.mcpServers)) delete nextMcp[name]
	}

	for (const [name, server] of Object.entries(config.mcpServers)) {
		const previous = isPlainObject(existingMcp[name]) ? existingMcp[name] : {}
		const enabled =
			typeof previous.enabled === "boolean" ? previous.enabled : true
		const timeout =
			typeof previous.timeout === "number" ? previous.timeout : undefined

		if ("type" in server && server.type === "http") {
			const headers = server.headers ?? toStringRecord(previous.headers)
			const oauth =
				(previous as any).oauth === false || isPlainObject((previous as any).oauth)
					? (previous as any).oauth
					: undefined

			nextMcp[name] = {
				type: "remote",
				url: server.url,
				enabled,
				...(headers ? { headers } : {}),
				...(oauth !== undefined ? { oauth } : {}),
				...(timeout !== undefined ? { timeout } : {}),
			}
		} else {
			const args = Array.isArray((server as any).args) ? (server as any).args : []
			const environment = (server as any).env ?? toStringRecord((previous as any).environment)

			nextMcp[name] = {
				type: "local",
				command: [server.command, ...args],
				enabled,
				...(environment ? { environment } : {}),
				...(timeout !== undefined ? { timeout } : {}),
			}
		}
	}

	const merged: Record<string, unknown> = {
		...existingConfig,
		...config,
		mcp: nextMcp,
	}

	// OpenCode schema does not allow these top-level keys.
	delete (merged as any).mcpServers
	delete (merged as any).mcp_servers

	verbose(`Writing config to file: ${configPath}`)
	fs.writeFileSync(configPath, JSON.stringify(merged, null, 2))
	verbose(`OpenCode config successfully written`)
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

	if (originalDoc) {
		let mcpServersNode = originalDoc.get("mcpServers")
		if (!mcpServersNode) {
			verbose(`mcpServers section not found, creating new section`)
			originalDoc.set("mcpServers", new YAML.YAMLMap())
			mcpServersNode = originalDoc.get("mcpServers")
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

				const existingServer = mcpServersNode.get(serverName)
				if (existingServer && typeof existingServer.set === "function") {
					verbose(
						`Updating existing server ${serverName} while preserving comments`,
					)
					for (const [key, value] of Object.entries(serverConfig)) {
						existingServer.set(key, value)
					}
				} else {
					verbose(`Adding new server ${serverName}`)
					mcpServersNode.set(serverName, serverConfig)
				}
			}
		} else {
			const nodeType = mcpServersNode ? typeof mcpServersNode : "undefined"
			throw new Error(
				`mcpServers section is not a proper YAML Map (found: ${nodeType}). Please ensure the YAML file has a valid mcpServers section or create a new file.`,
			)
		}

		fs.writeFileSync(configPath, originalDoc.toString())
		verbose(`YAML config updated`)
	} else {
		// Create new file from scratch
		const newConfig = { mcpServers: config.mcpServers }
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
	const mcpServersForToml: { [key: string]: any } = {}
	for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
		mcpServersForToml[serverName] = serverConfig
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
