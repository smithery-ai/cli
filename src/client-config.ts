import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { MCPConfig } from "./types/registry.js"

export interface ClientConfig extends MCPConfig {
	[key: string]: any
}

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

// Define client paths using the platform-specific base directories
const clientPaths: { [key: string]: string } = {
	claude: path.join(baseDir, "Claude", "claude_desktop_config.json"),
	cline: path.join(
		baseDir,
		vscodePath,
		"saoudrizwan.claude-dev",
		"settings",
		"cline_mcp_settings.json",
	),
	"roo-cline": path.join(
		baseDir,
		vscodePath,
		"rooveterinaryinc.roo-cline",
		"settings",
		"cline_mcp_settings.json",
	),
	windsurf: path.join(homeDir, ".codeium", "windsurf", "mcp_config.json"),
	witsy: path.join(baseDir, "Witsy", "settings.json"),
	enconvo: path.join(homeDir, ".config", "enconvo", "mcp_config.json"),
}

export function getConfigPath(client?: string): string {
	const normalizedClient = client?.toLowerCase() || "claude"
	return (
		clientPaths[normalizedClient] ||
		path.join(
			path.dirname(clientPaths.claude),
			"..",
			client || "claude",
			`${normalizedClient}_config.json`,
		)
	)
}

export function readConfig(client: string): ClientConfig {
	try {
		const configPath = getConfigPath(client)
		if (!fs.existsSync(configPath)) {
			return { mcpServers: {} }
		}
		const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf8"))

		return {
			...rawConfig,
			mcpServers: rawConfig.mcpServers || {},
		}
	} catch (error) {
		return { mcpServers: {} }
	}
}

export function writeConfig(config: ClientConfig, client?: string): void {
	const configPath = getConfigPath(client)
	const configDir = path.dirname(configPath)
	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true })
	}

	if (!config.mcpServers || typeof config.mcpServers !== "object") {
		throw new Error("Invalid mcpServers structure")
	}

	let existingConfig: ClientConfig = { mcpServers: {} }
	try {
		if (fs.existsSync(configPath)) {
			existingConfig = JSON.parse(fs.readFileSync(configPath, "utf8"))
		}
	} catch (error) {
		// If reading fails, continue with empty existing config
	}

	const mergedConfig = {
		...existingConfig,
		...config,
	}

	fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2))
}
