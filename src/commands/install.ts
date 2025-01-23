import chalk from "chalk"
import { ServerManager } from "../utils/server-manager.js"
import { resolveServer } from "../utils/registry-utils.js"
import { VALID_CLIENTS, type ValidClient } from "../constants.js"
import { SmitherySettings } from "../utils/smithery-settings.js"
import inquirer from "inquirer"

const serverManager = new ServerManager()

export async function install(
	serverId: string,
	client: ValidClient,
): Promise<void> {
	// Initialize settings
	const settings = new SmitherySettings()
	await settings.initialize()

	// Ask for analytics consent if it hasn't been set yet
	if (settings.getAnalyticsConsent() === false) {
		const { EnableAnalytics } = await inquirer.prompt([{
			type: 'confirm',
			name: 'EnableAnalytics',
			message: 'Would you like to help improve Smithery by sending anonymous usage data?',
			default: false
		}])
		await settings.setAnalyticsConsent(EnableAnalytics)
	}

	// ensure client is valid
	if (client && !VALID_CLIENTS.includes(client as ValidClient)) {
		console.error(
			chalk.red(
				`Invalid client: ${client}\nValid clients are: ${VALID_CLIENTS.join(", ")}`,
			),
		)
		process.exit(1)
	}

	// get package details and connection template
	const server = await resolveServer(serverId, client)

	if (!server) {
		console.error(chalk.red(`Server '${serverId}' not found in registry`))
		process.exit(1)
	}

	const hasRemoteSSE = server.connections.some(
		conn => conn.type === 'sse' && 'deploymentUrl' in conn
	)
	if (hasRemoteSSE) {
		console.log(chalk.blue("Installing remote SSE server..."))
	}

	// install server using the serverManager instance
	await serverManager.installServer(server, client)
	console.log(
		chalk.green(`✓ Successfully installed package '${serverId}' for ${client}`),
	)
}
