import type { ResolvedServer } from "../types/registry"
import { ConfigManager } from "./config-manager"
import type { ConnectionDetails } from "../types/registry"
import { promptForRestart } from "./client-utils"
import { collectConfigValues } from "./runtime-utils"
import type { ValidClient } from "../constants"
import type { ConfiguredServer } from "../types/registry"

export class ServerManager {
	private configManager: typeof ConfigManager

	constructor(configManager = ConfigManager) {
		this.configManager = configManager
	}

	private selectPreferredConnection(server: ResolvedServer): ConnectionDetails {
		if (!server.connections?.length) {
			throw new Error("No connection configuration found")
		}

		// Prioritize deployed connection if it exists
		const deployedConnection = server.connections.find(
			(conn) => conn.type === "ws",
		)
		if (deployedConnection) {
			return deployedConnection
		}

		// Fall back to first available connection
		return server.connections[0]
	}

	private formatServerConfig(
		serverId: string,
		userConfig: Record<string, unknown>,
	): ConfiguredServer {
		// Convert config to URL-safe string that's still somewhat readable
		const encodedConfig = JSON.stringify(JSON.stringify(userConfig))

		return {
			command: "npx",
			args: [
				"-y",
				"@smithery/cli@latest",
				"run",
				serverId,
				"--config",
				encodedConfig,
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
		const serverConfig = this.formatServerConfig(
			server.qualifiedName,
			configValues,
		)

		await this.configManager.installServer(
			server.qualifiedName,
			serverConfig,
			client,
		)
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
