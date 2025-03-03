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

import type { ValidClient } from "./constants"
import { promptForRestart } from "./utils/client"
import { normalizeServerId } from "./utils/config"
import { readConfig, writeConfig } from "./client-config"
import chalk from "chalk"
import ora from "ora"

/* uninstalls server for given client */
export async function uninstallServer(
	qualifiedName: string,
	client: ValidClient,
): Promise<void> {
	const spinner = ora(`Uninstalling ${qualifiedName}...`).start()

	try {
		/* read config from client */
		const config = readConfig(client)
		const normalizedName = normalizeServerId(qualifiedName)

		/* check if server exists in config */
		if (!config.mcpServers[normalizedName]) {
			spinner.fail(`Server ${qualifiedName} is not installed for ${client}`)
			return
		}

		/* remove server from config */
		delete config.mcpServers[normalizedName]
		writeConfig(config, client)

		spinner.succeed(`Successfully uninstalled ${qualifiedName}`)
		console.log(
			chalk.green(`${qualifiedName} successfully uninstalled from ${client}`),
		)

		await promptForRestart(client)
	} catch (error) {
		spinner.fail(`Failed to uninstall ${qualifiedName}`)
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
