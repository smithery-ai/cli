import "../utils/suppress-punycode-warning"
import chalk from "chalk"
import type { ValidClient } from "../config/clients"
import { getClientConfiguration } from "../config/clients.js"
import { readConfig, writeConfig } from "../lib/client-config-io"
import { deleteConfig } from "../lib/keychain.js"
import { promptForRestart } from "../utils/client"

/* uninstalls server for given client */
export async function uninstallServer(
	qualifiedName: string,
	client: ValidClient,
): Promise<void> {
	try {
		/* check if client is command-type */
		const clientConfig = getClientConfiguration(client)
		if (clientConfig.install.method === "command") {
			console.log(
				chalk.yellow(`Uninstallation is currently not supported for ${client}`),
			)
			return
		}

		/* read config from client */
		const config = readConfig(client)

		/* check if server exists in config */
		if (!config.mcpServers[qualifiedName]) {
			console.log(chalk.red(`${qualifiedName} is not installed for ${client}`))
			return
		}

		/* remove server from config */
		delete config.mcpServers[qualifiedName]
		writeConfig(config, client)

		/* remove server config from keychain */
		await deleteConfig(qualifiedName)

		console.log(
			chalk.green(`✓ ${qualifiedName} successfully uninstalled from ${client}`),
		)

		await promptForRestart(client)
	} catch (error) {
		if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`))
		} else {
			console.error(
				chalk.red("An unexpected error occurred during uninstallation"),
			)
		}
		process.exit(1)
	}
}
