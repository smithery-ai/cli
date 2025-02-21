import chalk from "chalk"
import { resolveServer } from "../utils/registry-utils.js"
import { handleServerAction } from "../utils/server-actions.js"
import { displayServerDetails } from "../utils/server-display.js"
import { VALID_CLIENTS, type ValidClient } from "../constants.js"
import { promptForClient } from "../utils/runtime-utils.js"

export async function get(serverId: string, client?: ValidClient) {
	try {
		// ensure client is valid
		if (client && !VALID_CLIENTS.includes(client as ValidClient)) {
			console.error(
				chalk.red(
					`Invalid client: ${client}\nValid clients are: ${VALID_CLIENTS.join(", ")}`,
				),
			)
			process.exit(1)
		}

		const server = await resolveServer(serverId, client)

		if (!server) {
			console.log(chalk.yellow(`No server found with ID: ${serverId}`))
			return
		}

		const action = await displayServerDetails(server, false)

		// If no client was provided and an action was selected, prompt for client
		let selectedClient = client
		if (!client && action !== "back") {
			selectedClient = await promptForClient()
		}

		await handleServerAction(server, action, {}, false, selectedClient)
	} catch (error) {
		console.error(chalk.red("Error loading server:"))
		if (error instanceof Error && error.message.includes("fetch")) {
			console.error(
				chalk.red(
					"Failed to connect to the registry. Please check your internet connection.",
				),
			)
		} else {
			console.error(
				chalk.red(error instanceof Error ? error.message : String(error)),
			)
		}
		process.exit(1)
	}
}
