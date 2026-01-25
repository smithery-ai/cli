import "../utils/suppress-punycode-warning"
import { APIConnectionTimeoutError } from "@smithery/api"
import chalk from "chalk"
import ora from "ora"
import type { ValidClient } from "../config/clients"
import { getClientConfiguration } from "../config/clients"
import {
	readConfig,
	runConfigCommand,
	writeConfig,
} from "../lib/client-config-io"
import { saveConfig } from "../lib/keychain"
import { verbose } from "../lib/logger"
import { resolveServer } from "../lib/registry"
import type { ServerConfig } from "../types/registry"
import { checkAnalyticsConsent } from "../utils/analytics"
import { promptForRestart } from "../utils/client"
import { getServerName } from "../utils/install/helpers"
import {
	determineConfigType,
	formatServerConfig,
} from "../utils/install/server-config"
import { resolveUserConfig } from "../utils/install/user-config"
import {
	checkAndNotifyRemoteServer,
	ensureBunInstalled,
	ensureUVInstalled,
} from "../utils/runtime"

/**
 * Installs and configures a Smithery server for a specified client.
 * Prompts for config values if config not given OR saved config not found in keychain
 *
 * @param {string} qualifiedName - The qualified name of the server to install
 * @param {ValidClient} client - The client to install the server for
 * @param {ServerConfig} configValues - Configuration values for the server (from --config flag, can be empty object)
 * @returns {Promise<void>} A promise that resolves when installation is complete
 * @throws Will throw an error if installation fails
 */
export async function installServer(
	qualifiedName: string,
	client: ValidClient,
	configValues: ServerConfig,
): Promise<void> {
	verbose(`Starting installation of ${qualifiedName} for client ${client}`)

	/* check analytics consent */
	await checkAnalyticsConsent()

	// get client configuration details
	const clientConfig = getClientConfiguration(client)

	/* resolve server */
	const spinner = ora(`Resolving ${qualifiedName}...`).start()
	try {
		const { server, connection } = await resolveServer(qualifiedName)
		spinner.succeed(
			chalk.dim(`Successfully resolved ${chalk.cyan(qualifiedName)}`),
		)

		// Check for required runtimes and install if needed (only for stdio connections)
		if (connection.type === "stdio") {
			await ensureUVInstalled(connection)
			await ensureBunInstalled(connection)
		}

		// Notify user if remote server
		checkAndNotifyRemoteServer(server)

		// Determine the config type to decide if we need to collect config
		const configType = determineConfigType(client, server)

		/* resolve server configuration - skip for OAuth flows since browser handles config */
		let finalConfig: ServerConfig = {}
		if (configType !== "http-oauth") {
			finalConfig = await resolveUserConfig(
				connection,
				qualifiedName,
				configValues,
				spinner,
			)

			verbose(`Config values: ${JSON.stringify(finalConfig, null, 2)}`)

			// Save config to keychain
			if (Object.keys(finalConfig).length > 0) {
				await saveConfig(qualifiedName, finalConfig)
			}
		} else {
			verbose("Skipping config collection for OAuth flow")
		}

		/* Install for client */
		const serverConfig = formatServerConfig(
			qualifiedName,
			client, // Pass client name to determine transport type
			server, // Pass server details to check HTTP support
		)

		verbose(`Formatted server config: ${JSON.stringify(serverConfig, null, 2)}`)
		const serverName = getServerName(qualifiedName)

		switch (clientConfig.installType) {
			case "command": {
				// For command-based clients, execute command directly for this server only
				verbose("Command-based client detected, executing command directly...")
				const targetServerConfig = {
					mcpServers: {
						[serverName]: serverConfig,
					},
				}
				runConfigCommand(targetServerConfig, clientConfig)
				break
			}
			case "json":
			case "yaml": {
				// For file-based clients, read existing config and merge
				const config = readConfig(client)
				config.mcpServers[serverName] = serverConfig
				writeConfig(config, client)
				break
			}
		}

		console.log()
		console.log(
			chalk.green(`✓ ${qualifiedName} successfully installed for ${client}`),
		)
		await promptForRestart(client)
		process.exit(0)
	} catch (error) {
		spinner.fail(`Failed to install ${qualifiedName}`)
		verbose(
			`Installation error: ${error instanceof Error ? error.stack : JSON.stringify(error)}`,
		)
		if (error instanceof APIConnectionTimeoutError) {
			console.error(
				chalk.red(
					"Error: Request timed out. Please check your connection and try again.",
				),
			)
		} else if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`))
		} else {
			console.error(
				chalk.red("An unexpected error occurred during installation"),
			)
		}
		process.exit(1)
	}
}
