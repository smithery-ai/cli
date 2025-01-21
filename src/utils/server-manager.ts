import type { ResolvedServer } from "../types/registry.js"
import { ConfigManager } from "./config-manager.js"
import type { ConnectionDetails } from "../types/registry.js"
// import { getServerConfiguration } from "./registry-utils.js"
import { promptForRestart } from "./client-utils.js"
import { collectConfigValues } from "./runtime-utils.js"
import type { ValidClient } from "../constants.js"
import type { ConfiguredServer } from "../types/registry.js"

export class ServerManager {
	private configManager: typeof ConfigManager

	constructor(configManager = ConfigManager) {
		this.configManager = configManager
	}

	private selectPreferredConnection(server: ResolvedServer): ConnectionDetails {
		if (!server.connections?.length) {
			throw new Error("No connection configuration found")
		}

		// Prioritize SSE connection if it exists
		const sseConnection = server.connections.find((conn) => conn.type === "sse")
		if (sseConnection) {
			return sseConnection
		}

		// Fall back to first available connection
		return server.connections[0]
	}

	private formatServerConfig(
		serverId: string,
		userConfig: Record<string, unknown>,
	): ConfiguredServer {
		return {
			command: "npx",
			args: [
				"-y",
				"@smithery/cli",
				"run",
				serverId,
				"--config",
				JSON.stringify(userConfig),
			],
		}
	}

	async installServer(
		server: ResolvedServer,
		client: ValidClient,
	): Promise<void> {
		const connection = this.selectPreferredConnection(server) // checks if it has any connections
		const configValues = await collectConfigValues(connection) // config values collected from configschema

		// Update: Instead of getting config from registry POST, format it for run command
		const serverConfig = this.formatServerConfig(server.id, configValues)

		await this.configManager.installServer(server.id, serverConfig, client)
		await promptForRestart(client)
	}

	async uninstallServer(serverId: string, client: string): Promise<void> {
		try {
			await this.configManager.uninstallServer(serverId, client)
			console.log(`\nUninstalled ${serverId}`)
			await promptForRestart(client)
		} catch (error) {
			console.error("Failed to uninstall server:", error)
			throw error
		}
	}
}
