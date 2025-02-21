import inquirer from "inquirer"
import chalk from "chalk"
import { fetchServers } from "../utils/registry-utils.js"
import type { ResolvedServer } from "../types/registry.js"
import AutocompletePrompt from "inquirer-autocomplete-prompt"
import { handleServerAction } from "../utils/server-actions.js"
import { ConfigManager } from "../utils/config-manager.js"
import {
	displayServerDetails,
	printServerListHeader,
	createListChoices,
} from "../utils/server-display.js"
import type { ValidClient } from "../constants.js"
import { promptForClient } from "../utils/runtime-utils.js"

inquirer.registerPrompt("autocomplete", AutocompletePrompt)

let installedServersCache: ResolvedServer[] | null = null

export async function listInstalledServers(
	initialClient?: ValidClient,
): Promise<void> {
	let currentClient = initialClient

	while (true) {
		// if no client provided, prompt user to select one
		if (!currentClient) {
			currentClient = await promptForClient()
		}

		const installedIds = ConfigManager.getInstalledServerIds(
			currentClient as ValidClient,
		)

		if (installedIds.length === 0) {
			console.log(
				chalk.yellow(
					`\nNo MCP servers are currently installed for ${currentClient}.`,
				),
			)
			return
		}

		const denormalizedIds = installedIds.map((id) =>
			ConfigManager.denormalizeServerId(id),
		)
		if (
			!installedServersCache ||
			!areArraysEqual(
				denormalizedIds,
				installedServersCache.map((server) => server.qualifiedName),
			)
		) {
			installedServersCache = await fetchServers(
				currentClient as ValidClient,
				denormalizedIds,
			)
			installedServersCache.forEach((server) => {
				server.isInstalled = true
			})
		}

		printServerListHeader(
			installedServersCache.length,
			"installed",
			currentClient,
		)

		const prompt = {
			type: "list",
			name: "selectedServer",
			message: "Search and select a server:",
			choices: createListChoices(installedServersCache, false, true),
		}
		const answer = await inquirer.prompt<{
			selectedServer: ResolvedServer | "exit" | "back"
		}>([prompt])

		if (!answer.selectedServer || answer.selectedServer === "exit") {
			process.exit(0)
		}

		if (answer.selectedServer === "back") {
			currentClient = undefined // Reset client to trigger selection
			continue
		}

		const action = await displayServerDetails(answer.selectedServer)
		await handleServerAction(
			answer.selectedServer,
			action,
			{
				onUninstall: (_, client) => listInstalledServers(client),
				onBack: () => listInstalledServers(currentClient),
			},
			true,
			currentClient,
		)
	}
}

function areArraysEqual(arr1: string[], arr2: string[]): boolean {
	return (
		arr1.length === arr2.length &&
		arr1.every((value, index) => value === arr2[index])
	)
}
