import chalk from "chalk"
import type { ResolvedServer } from "../types/registry.js"
import { ServerManager } from "./server-manager.js"
import { displayServerDetails, confirmUninstall } from "./server-display.js"
import type { ValidClient } from "../constants.js"

export type ActionHandler = {
	onInstall?: (server: ResolvedServer) => Promise<void>
	onUninstall?: (server: ResolvedServer, client: ValidClient) => Promise<void>
	onBack?: () => Promise<void>
}

const serverManager = new ServerManager()

export async function handleServerAction(
	server: ResolvedServer,
	action: string,
	handlers: ActionHandler,
	showActionsAfter = true,
	client: ValidClient = "claude",
): Promise<void> {
	switch (action) {
		case "install":
			console.log(chalk.cyan(`\nPreparing to install ${server.name}...`))
			await serverManager.installServer(server, client)
			server.isInstalled = true
			if (handlers.onInstall) {
				await handlers.onInstall(server)
			}
			console.log(chalk.green(`\nSuccessfully installed ${server.name}`))
			return // Exit after successful installation
		case "uninstall":
			if (await confirmUninstall(server.name)) {
				await serverManager.uninstallServer(server.qualifiedName, client)
				console.log(
					chalk.green(`Successfully uninstalled ${server.name} for ${client}`),
				)
				server.isInstalled = false
				if (handlers.onUninstall) {
					await handlers.onUninstall(server, client)
				}
				return // Exit after successful uninstallation
			} else {
				console.log("Uninstallation cancelled.")
			}
			break
		case "back":
			if (handlers.onBack) {
				await handlers.onBack()
			}
			return
		case "exit":
			process.exit(0)
	}

	// Show actions again after completing an action (except for exit/back)
	if (showActionsAfter) {
		const nextAction = await displayServerDetails(server)
		await handleServerAction(
			server,
			nextAction,
			handlers,
			showActionsAfter,
			client,
		)
	}
}
