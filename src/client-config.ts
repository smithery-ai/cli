import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { MCPConfig } from "./types/registry.js"
import { verbose } from "./logger"
import { execFileSync } from "node:child_process"

export interface ClientConfig extends MCPConfig {
	[key: string]: any
}

interface ClientFileTarget {
	type: "file"
	path: string
}

interface ClientCommandTarget {
	type: "command"
	command: string
}

type ClientInstallTarget = ClientCommandTarget | ClientFileTarget

// Initialize platform-specific paths
const homeDir = os.homedir()

const platformPaths = {
	win32: {
		baseDir: process.env.APPDATA || path.join(homeDir, "AppData", "Roaming"),
		vscodePath: path.join("Code", "User", "globalStorage"),
	},
	darwin: {
		baseDir: path.join(homeDir, "Library", "Application Support"),
		vscodePath: path.join("Code", "User", "globalStorage"),
	},
	linux: {
		baseDir: process.env.XDG_CONFIG_HOME || path.join(homeDir, ".config"),
		vscodePath: path.join("Code/User/globalStorage"),
	},
}

const platform = process.platform as keyof typeof platformPaths
const { baseDir, vscodePath } = platformPaths[platform]
const defaultClaudePath = path.join(
	baseDir,
	"Claude",
	"claude_desktop_config.json",
)

// Define client paths using the platform-specific base directories
const clientPaths: { [key: string]: ClientInstallTarget } = {
	claude: { type: "file", path: defaultClaudePath },
	cline: {
		type: "file",
		path: path.join(
			baseDir,
			vscodePath,
			"saoudrizwan.claude-dev",
			"settings",
			"cline_mcp_settings.json",
		),
	},
	roocode: {
		type: "file",
		path: path.join(
			baseDir,
			vscodePath,
			"rooveterinaryinc.roo-cline",
			"settings",
			"mcp_settings.json",
		),
	},
	windsurf: {
		type: "file",
		path: path.join(homeDir, ".codeium", "windsurf", "mcp_config.json"),
	},
	witsy: { type: "file", path: path.join(baseDir, "Witsy", "settings.json") },
	enconvo: {
		type: "file",
		path: path.join(homeDir, ".config", "enconvo", "mcp_config.json"),
	},
	cursor: { type: "file", path: path.join(homeDir, ".cursor", "mcp.json") },
	vscode: {
		type: "command",
		command: process.platform === "win32" ? "code.cmd" : "code",
	},
	"vscode-insiders": {
		type: "command",
		command:
			process.platform === "win32" ? "code-insiders.cmd" : "code-insiders",
	},
	boltai: { type: "file", path: path.join(homeDir, ".boltai", "mcp.json") },
	"amazon-bedrock": {
		type: "file",
		path: path.join(homeDir, "Amazon Bedrock Client", "mcp_config.json"),
	},
	amazonq: {
		type: "file",
		path: path.join(homeDir, ".aws", "amazonq", "mcp.json"),
	},
}

export function getConfigPath(client?: string): ClientInstallTarget {
	const normalizedClient = client?.toLowerCase() || "claude"
	verbose(`Getting config path for client: ${normalizedClient}`)

	const configTarget = clientPaths[normalizedClient] || {
		type: "file",
		path: path.join(
			path.dirname(defaultClaudePath),
			"..",
			client || "claude",
			`${normalizedClient}_config.json`,
		),
	}

	verbose(`Config path resolved to: ${JSON.stringify(configTarget)}`)
	return configTarget
}

export function readConfig(client: string): ClientConfig {
	verbose(`Reading config for client: ${client}`)
	try {
		const configPath = getConfigPath(client)

		// Command-based installers (i.e. VS Code) do not currently support listing servers
		if (configPath.type === "command") {
			return { mcpServers: {} }
		}

		verbose(`Checking if config file exists at: ${configPath}`)
		if (!fs.existsSync(configPath.path)) {
			verbose(`Config file not found, returning default empty config`)
			return { mcpServers: {} }
		}

		verbose(`Reading config file content`)
		const rawConfig = JSON.parse(fs.readFileSync(configPath.path, "utf8"))
		verbose(`Config loaded successfully: ${JSON.stringify(rawConfig, null, 2)}`)

		return {
			...rawConfig,
			mcpServers: rawConfig.mcpServers || {},
		}
	} catch (error) {
		verbose(
			`Error reading config: ${error instanceof Error ? error.stack : JSON.stringify(error)}`,
		)
		return { mcpServers: {} }
	}
}

export function writeConfig(config: ClientConfig, client?: string): void {
	verbose(`Writing config for client: ${client || "default"}`)
	verbose(`Config data: ${JSON.stringify(config, null, 2)}`)

	if (!config.mcpServers || typeof config.mcpServers !== "object") {
		verbose(`Invalid mcpServers structure in config`)
		throw new Error("Invalid mcpServers structure")
	}

	const configPath = getConfigPath(client)
	if (configPath.type === "command") {
		writeConfigCommand(config, configPath)
	} else {
		writeConfigFile(config, configPath)
	}
}

function writeConfigCommand(
	config: ClientConfig,
	target: ClientCommandTarget,
): void {
	const args: string[] = []
	for (const [name, server] of Object.entries(config.mcpServers)) {
		args.push("--add-mcp", JSON.stringify({ ...server, name }))
	}

	verbose(`Running command: ${JSON.stringify([target.command, ...args])}`)

	try {
		const output = execFileSync(target.command, args)
		verbose(`Executed command successfully: ${output.toString()}`)
	} catch (error) {
		verbose(
			`Error executing command: ${error instanceof Error ? error.message : String(error)}`,
		)

		if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(
				`Command '${target.command}' not found. Make sure ${target.command} is installed and on your PATH`,
			)
		}

		throw error
	}
}

function writeConfigFile(config: ClientConfig, target: ClientFileTarget): void {
	const configDir = path.dirname(target.path)

	verbose(`Ensuring config directory exists: ${configDir}`)
	if (!fs.existsSync(configDir)) {
		verbose(`Creating directory: ${configDir}`)
		fs.mkdirSync(configDir, { recursive: true })
	}

	let existingConfig: ClientConfig = { mcpServers: {} }
	try {
		if (fs.existsSync(target.path)) {
			verbose(`Reading existing config file for merging`)
			existingConfig = JSON.parse(fs.readFileSync(target.path, "utf8"))
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

	verbose(`Writing config to file: ${target.path}`)
	fs.writeFileSync(target.path, JSON.stringify(mergedConfig, null, 2))
	verbose(`Config successfully written`)
}
