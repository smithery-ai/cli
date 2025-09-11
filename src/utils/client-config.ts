import fs from "node:fs"
import * as YAML from "yaml"
import * as TOML from "toml"
import path from "node:path"
import type { MCPConfig } from "../types/registry.js"
import { verbose } from "../lib/logger.js"
import { execFileSync } from "node:child_process"
import {
	getClientConfiguration,
	type ClientConfiguration,
} from "../config/clients.js"

export interface ClientMCPConfig extends MCPConfig {
	[key: string]: any
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
				rawConfig = TOML.parse(fileContent) as any
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
			existingConfig = TOML.parse(existingContent)
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

	// Convert to TOML format
	const tomlContent = Object.entries(mergedConfig)
		.map(([section, content]) => {
			if (section === "mcp_servers" && typeof content === "object") {
				// Handle mcp_servers section specially
				return Object.entries(content as Record<string, any>)
					.map(([serverName, serverConfig]) => {
						const lines = [`[mcp_servers.${serverName}]`]
						for (const [key, value] of Object.entries(
							serverConfig as Record<string, any>,
						)) {
							if (Array.isArray(value)) {
								// Handle arrays by converting each element properly
								const arrayElements = value
									.map((item) => {
										if (typeof item === "string") {
											// For strings containing JSON or complex characters, use literal strings
											if (item.includes("{") || item.includes('"')) {
												// Use TOML literal strings (single quotes) for complex strings
												return `'${item.replace(/'/g, "''")}'`
											} else {
												// Use regular quoted strings for simple strings
												return `"${item}"`
											}
										} else {
											return JSON.stringify(item)
										}
									})
									.join(", ")
								lines.push(`${key} = [${arrayElements}]`)
							} else if (typeof value === "object" && value !== null) {
								// Handle env object specially
								if (key === "env") {
									const envEntries = Object.entries(
										value as Record<string, string>,
									)
										.map(([envKey, envValue]) => `"${envKey}" = "${envValue}"`)
										.join(", ")
									lines.push(`${key} = { ${envEntries} }`)
								} else {
									lines.push(`${key} = ${JSON.stringify(value)}`)
								}
							} else if (typeof value === "string") {
								// Escape quotes in strings for TOML
								lines.push(`${key} = "${value.replace(/"/g, '\\"')}"`)
							} else {
								lines.push(`${key} = ${value}`)
							}
						}
						return lines.join("\n")
					})
					.join("\n\n")
			} else if (typeof content === "object") {
				// Handle other sections
				const lines = [`[${section}]`]
				for (const [key, value] of Object.entries(
					content as Record<string, any>,
				)) {
					if (typeof value === "string") {
						lines.push(`${key} = "${value}"`)
					} else {
						lines.push(`${key} = ${JSON.stringify(value)}`)
					}
				}
				return lines.join("\n")
			} else {
				// Handle top-level properties
				if (typeof content === "string") {
					return `${section} = "${content}"`
				} else {
					return `${section} = ${JSON.stringify(content)}`
				}
			}
		})
		.filter(Boolean)
		.join("\n\n")

	verbose(`Writing TOML config to file: ${configPath}`)
	fs.writeFileSync(configPath, tomlContent)
	verbose(`TOML config successfully written`)
}
