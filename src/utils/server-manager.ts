import type { ResolvedServer } from "../types/registry.js"
import { ConfigManager } from "./config-manager.js"
import type { ConnectionDetails } from "../types/registry.js"
import { getServerConfiguration } from "./registry-utils.js"
import { promptForRestart } from "./client-utils.js"
import { collectConfigValues } from "./runtime-utils.js"
import type { ValidClient } from "../constants.js"
import type { ConfiguredServer } from "../types/registry.js"

export class ServerManager {
	private configManager: typeof ConfigManager

	constructor(configManager = ConfigManager) {
		this.configManager = configManager
	}

	private validateConnection(server: ResolvedServer): ConnectionDetails {
		const connection = server.connections?.[0]
		if (!connection) {
			throw new Error("No connection configuration found or server has not been deployed.")
		}
		return connection
	}

	private formatServerConfig(
		serverId: string,
		userConfig: Record<string, unknown>
	): ConfiguredServer {
		return {
			command: "npx",
			args: [
				"-y",
				"@smithery/cli",
				"run",
				serverId,
				"--config",
				JSON.stringify(userConfig)
			]
		}
	}

	async installServer(
		server: ResolvedServer,
		client: ValidClient,
	): Promise<void> {
		const connection = this.validateConnection(server)
		const values = await collectConfigValues(connection)
		
		// Instead of getting config from registry, format it for CLI
		const serverConfig = this.formatServerConfig(server.id, values)

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
