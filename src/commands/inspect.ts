import chalk from "chalk"
import {
	createServerConnection,
	inspectServer,
} from "../utils/server-inspector.js"
import { ConfigManager } from "../utils/config-manager.js"
import { createListChoices } from "../utils/server-display.js"
import inquirer from "inquirer"
import type { ValidClient } from "../constants.js"
import { printServerListHeader } from "../utils/server-display.js"
import { promptForClient } from "../utils/runtime-utils.js"

process.removeAllListeners("warning")

export async function inspect(initialClient?: ValidClient): Promise<void> {
	try {
		let currentClient = initialClient
		while (true) {
			/* Select client */
			if (!currentClient) {
				currentClient = await promptForClient()
			}

			const installedIds = ConfigManager.getInstalledServerIds(
				currentClient as ValidClient,
			)

			if (installedIds.length === 0) {
				console.log(chalk.yellow("\nNo MCP servers are currently installed."))
				return
			}

			/* Read client config */
			const ClientConfig = ConfigManager.readConfig(
				currentClient as ValidClient,
			)
			const Servers = ClientConfig.mcpServers

			printServerListHeader(
				Object.keys(Servers).length,
				"installed",
				currentClient,
			)

			const choices = createListChoices(
				installedIds.map((id) => ({
					qualifiedName: id,
					name: id,
					isInstalled: true,
					connections: [],
				})),
				false,
				true,
			)

			/* Prompt for selection */
			const { selectedId } = await inquirer.prompt([
				{
					type: "list",
					name: "selectedId",
					message: "Select a server to inspect:",
					choices,
				},
			])

			if (selectedId === "exit") {
				process.exit(0)
			}

			if (selectedId === "back") {
				currentClient = undefined // Reset client to trigger selection
				continue
			}

			if (!selectedId) {
				return
			}

			/* Connect and inspect */
			console.log(chalk.blue("\nConnecting to server..."))
			const connectionConfig = Servers[selectedId.qualifiedName]

			if ("command" in connectionConfig) {
				const client = await createServerConnection(
					selectedId.qualifiedName,
					connectionConfig,
				)
				const result = await inspectServer(client)
				if (result === "exit") {
					process.exit(0)
				}
			} else {
				throw new Error("Only stdio connections are supported")
			}
		}
	} catch (error) {
		console.error(chalk.red("Error during inspection:"))
		console.error(
			chalk.red(error instanceof Error ? error.message : String(error)),
		)
		process.exit(1)
	}
}
