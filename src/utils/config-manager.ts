import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { MCPConfig, ConfiguredServer } from "../types/registry.js"

export interface ClientConfig extends MCPConfig {
	[key: string]: any
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class ConfigManager {
	private static configPath: string
	private static clientPaths: Record<string, string>

	static {
		const homeDir = os.homedir()

		// Define platform-specific base directories
		const platformPaths = {
			win32: {
				baseDir:
					process.env.APPDATA || path.join(homeDir, "AppData", "Roaming"),
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
		const clientPaths = {
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
		ConfigManager.configPath = clientPaths.claude
		ConfigManager.clientPaths = clientPaths
	}

	static getConfigPath(client?: string): string {
		const normalizedClient = client?.toLowerCase() || "claude"
		return (
			ConfigManager.clientPaths[normalizedClient] ||
			path.join(
				path.dirname(ConfigManager.configPath),
				"..",
				client || "claude",
				`${normalizedClient}_config.json`,
			)
		)
	}

	static readConfig(client: string): ClientConfig {
		try {
			const configPath = ConfigManager.getConfigPath(client)
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

	static writeConfig(config: ClientConfig, client?: string): void {
		const configPath = ConfigManager.getConfigPath(client)
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

	static isServerInstalled(id: string, client: string): boolean {
		const config = ConfigManager.readConfig(client)
		const normalizedId = ConfigManager.normalizeServerId(id)
		return normalizedId in config.mcpServers
	}

	static async installServer(
		id: string,
		serverConfig: ConfiguredServer,
		client: string,
	): Promise<void> {
		const normalizedId = ConfigManager.normalizeServerId(id)
		const config = ConfigManager.readConfig(client)
		config.mcpServers[normalizedId] = serverConfig
		ConfigManager.writeConfig(config, client)
	}

	static async uninstallServer(id: string, client: string): Promise<void> {
		const normalizedId = ConfigManager.normalizeServerId(id)
		const config = ConfigManager.readConfig(client)
		if (!config.mcpServers[normalizedId]) {
			console.log(`Server ${normalizedId} not found in configuration`)
			return
		}
		delete config.mcpServers[normalizedId]
		ConfigManager.writeConfig(config, client)
	}

	static getServerConfig(id: string, client: string): ConfiguredServer | null {
		const config = ConfigManager.readConfig(client)
		return config.mcpServers[id] || null
	}

	static envVarsToArgs(envVars: Record<string, string>): string[] {
		return Object.entries(envVars).flatMap(([key, value]) => {
			const argName = key.toLowerCase().replace(/_/g, "-")
			return [`--${argName}`, value]
		})
	}

	static normalizeServerId(serverId: string): string {
		if (serverId.startsWith("@")) {
			const firstSlashIndex = serverId.indexOf("/")
			if (firstSlashIndex !== -1) {
				return `${serverId.substring(0, firstSlashIndex)}-${serverId.substring(firstSlashIndex + 1)}`
			}
		}
		return serverId
	}

	static denormalizeServerId(normalizedId: string): string {
		if (normalizedId.startsWith("@")) {
			const dashIndex = normalizedId.indexOf("-")
			if (dashIndex !== -1) {
				return `${normalizedId.substring(0, dashIndex)}/${normalizedId.substring(dashIndex + 1)}`
			}
		}
		return normalizedId
	}

	// get locally installed servers
	static getInstalledServerIds(client: string): string[] {
		const config = ConfigManager.readConfig(client)
		const ids = Object.keys(config.mcpServers || {})
		return ids
	}
}
