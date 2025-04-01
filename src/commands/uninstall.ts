/* remove punycode depreciation warning */
process.removeAllListeners("warning")
process.on("warning", (warning) => {
	if (
		warning.name === "DeprecationWarning" &&
		warning.message.includes("punycode")
	) {
		return
	}
	console.warn(warning)
})

import type { ValidClient } from "../constants"
import { promptForRestart } from "../utils/client"
import { getConfigPath } from "../client-config"
import { readConfig, writeConfig } from "../client-config"
import chalk from "chalk"

/* uninstalls server for given client */
export async function uninstallServer(
	qualifiedName: string,
	client: ValidClient,
): Promise<void> {
	try {
		/* check if client is command-type */
		const configTarget = getConfigPath(client)
		if (configTarget.type === "command") {
			console.log(
				chalk.yellow(`Uninstallation is currently not supported for ${client}`),
			)
			return
		}

		/* read config from client */
		const config = readConfig(client)

		/* check if server exists in config */
		if (!config.mcpServers[qualifiedName]) {
			console.log(
				chalk.red(`Server ${qualifiedName} is not installed for ${client}`),
			)
			return
		}

		/* remove server from config */
		delete config.mcpServers[qualifiedName]
		writeConfig(config, client)

		console.log(
			chalk.green(`${qualifiedName} successfully uninstalled from ${client}`),
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
