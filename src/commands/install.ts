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

import chalk from "chalk"
import ora from "ora"
import type { ValidClient } from "../config/clients"
import { getClientConfiguration } from "../config/clients"
import { verbose } from "../lib/logger"
import {
	ResolveServerSource,
	resolveServer,
	saveUserConfig,
	validateUserConfig,
} from "../lib/registry"
import type { ServerConfig } from "../types/registry"
import { checkAnalyticsConsent } from "../utils/analytics"
import { promptForRestart } from "../utils/client"
import { readConfig, runConfigCommand, writeConfig } from "../utils/mcp-config"
import {
	checkAndNotifyRemoteServer,
	ensureApiKey,
	ensureBunInstalled,
	ensureUVInstalled,
	isRemote,
} from "../utils/runtime"
import {
	collectConfigValues,
	formatServerConfig,
	getServerName,
} from "../utils/session-config"

/**
 * Installs and configures a Smithery server for a specified client.
 * Prompts for config values if config not given OR saved config not valid
 *
 * @param {string} qualifiedName - The qualified name of the server to install
 * @param {ValidClient} client - The client to install the server for
 * @param {Record<string, unknown>} [configValues] - Optional configuration values for the server
 * @param {string} [apiKey] - Optional API key (during installation, local servers don't need key; remote servers prompt for key)
 * @param {string} [profile] - Optional profile name to use
 * @returns {Promise<void>} A promise that resolves when installation is complete
 * @throws Will throw an error if installation fails
 */
export async function installServer(
	qualifiedName: string,
	client: ValidClient,
	configValues: ServerConfig,
	apiKey: string | undefined,
	profile: string | undefined,
): Promise<void> {
	verbose(`Starting installation of ${qualifiedName} for client ${client}`)

	/* start resolving in background */
	verbose(`Resolving package: ${qualifiedName}`)

	/* check analytics consent */
	try {
		verbose("Checking analytics consent...")
		await checkAnalyticsConsent()
		verbose("Analytics consent check completed")
	} catch (error) {
		console.warn(
			chalk.yellow("[Analytics] Failed to check consent:"),
			error instanceof Error ? error.message : String(error),
		)
		verbose(`Analytics consent check error details: ${JSON.stringify(error)}`)
	}

	const spinner = ora(`Resolving ${qualifiedName}...`).start()
	try {
		verbose("Awaiting server resolution...")
		const server = await resolveServer(
			qualifiedName,
			apiKey,
			ResolveServerSource.Install,
		)
		verbose(`Server resolved successfully: ${server.qualifiedName}`)
		spinner.succeed(
			chalk.dim(`Successfully resolved ${chalk.cyan(qualifiedName)}`),
		)

		/* choose connection type */
		verbose("Choosing connection type...")
		if (!server.connections?.length) {
			throw new Error("No connection configuration found for server")
		}
		const connection = server.connections[0]
		verbose(`Selected connection: ${JSON.stringify(connection, null, 2)}`)

		/* Check for required runtimes and install if needed */
		await ensureUVInstalled(connection)
		await ensureBunInstalled(connection)

		/* inform users of remote server installation and prompt for API key if needed */
		let finalApiKey = apiKey
		if (isRemote(server) && !apiKey) {
			spinner.stop()
			finalApiKey = await ensureApiKey()
		}
		checkAndNotifyRemoteServer(server)

		let collectedConfigValues: ServerConfig = configValues || {}

		// Check existing config first
		if (finalApiKey && Object.keys(configValues).length === 0) {
			try {
				verbose("Checking existing configuration...")
				const configSpinner = ora("Validating configuration...").start()
				const validation = await validateUserConfig(
					qualifiedName,
					finalApiKey,
					profile,
				)
				configSpinner.succeed(chalk.dim("Configuration valid"))

				if (validation.isComplete) {
					// Check if there are any config fields at all (required or optional)
					const hasConfigFields =
						Object.keys(validation.fieldSchemas).length > 0

					if (hasConfigFields) {
						// Show different message based on whether config actually exists
						if (validation.hasExistingConfig) {
							const profileMsg = profile
								? `Found existing configuration from profile: ${chalk.cyan(profile)}`
								: "Found existing configuration from default profile"
							console.log(`${chalk.green("●")} ${chalk.dim(profileMsg)}`)

							// Don't prompt to update - they can use the web UI link
							collectedConfigValues = {} // Use existing saved config
						} else {
							console.log(
								`${chalk.cyan("○")} ${chalk.dim("No configuration saved yet")}`,
							)

							// No existing config, offer to add optional fields
							collectedConfigValues = await collectConfigValues(
								connection,
								configValues || {},
							)
						}
					} else {
						console.log()
						console.log(`${chalk.cyan("○")} No configuration required`)
						collectedConfigValues = {} // No config needed at all
					}
				} else {
					console.log(
						chalk.yellow("!"),
						`Missing required config: ${validation.missingFields.join(", ")}`,
					)
					// Prompt for all fields
					collectedConfigValues = await collectConfigValues(
						connection,
						configValues || {},
					)
					// Link will be shown after saving
				}
			} catch (error) {
				verbose(
					`Config validation failed: ${error instanceof Error ? error.message : String(error)}`,
				)
				// Fall back to normal prompting
				collectedConfigValues = await collectConfigValues(
					connection,
					configValues || {},
				)
			}
		} else if (Object.keys(configValues).length === 0) {
			// No API key or no existing config, prompt normally
			collectedConfigValues = await collectConfigValues(
				connection,
				configValues || {},
			)
		}

		verbose(`Config values: ${JSON.stringify(collectedConfigValues, null, 2)}`)

		/* Save user config to smithery if API key is available */
		let configSavedToSmithery = false
		if (finalApiKey && Object.keys(collectedConfigValues).length > 0) {
			verbose("Saving configuration to smithery...")
			const saveSpinner = ora("Saving configuration...").start()
			try {
				await saveUserConfig(
					qualifiedName,
					collectedConfigValues,
					finalApiKey,
					profile,
				)
				verbose("Configuration successfully saved to smithery")
				saveSpinner.succeed(chalk.dim("Configuration saved"))
				configSavedToSmithery = true

				// Show manage config link after successful save
				const configUrl = profile
					? `https://smithery.ai/account/profiles/${profile}/${qualifiedName}`
					: `https://smithery.ai/account/profiles?server=${qualifiedName}`
				console.log()
				console.log(`${chalk.cyan("→ Manage configuration:")} ${configUrl}`)
			} catch (error) {
				verbose(
					`Failed to save config to smithery: ${error instanceof Error ? error.message : String(error)}`,
				)
				saveSpinner.fail(chalk.dim("Failed to save configuration"))
				// Don't fail the installation if config save fails
				console.warn(
					chalk.yellow(
						"Warning: Could not save configuration. Config will be saved locally.",
					),
				)
			}
		} else if (finalApiKey) {
			// Show manage config link if there's existing config (even if nothing new to save)
			const hasConfigToManage =
				connection.configSchema?.properties &&
				Object.keys(connection.configSchema.properties).length > 0

			if (hasConfigToManage) {
				const configUrl = profile
					? `https://smithery.ai/account/profiles/${profile}/${qualifiedName}`
					: `https://smithery.ai/account/profiles?server=${qualifiedName}`
				console.log()
				console.log(`${chalk.cyan("→ Manage configuration:")} ${configUrl}`)
			}
		}

		verbose("Formatting server configuration...")
		const serverConfig = formatServerConfig(
			qualifiedName,
			configSavedToSmithery ? {} : collectedConfigValues, // Use empty config if saved to smithery
			finalApiKey,
			profile,
			client, // Pass client name to determine transport type
			server, // Pass server details to check HTTP support
		)
		verbose(`Formatted server config: ${JSON.stringify(serverConfig, null, 2)}`)

		verbose("Normalizing server ID...")
		const serverName = getServerName(qualifiedName)
		verbose(`Normalized server ID: ${serverName}`)

		// Check if this is a command-based client
		const clientConfig = getClientConfiguration(client)

		if (clientConfig.installType === "command") {
			// For command-based clients, execute command directly for this server only
			verbose("Command-based client detected, executing command directly...")
			const targetServerConfig = {
				mcpServers: {
					[serverName]: serverConfig,
				},
			}
			runConfigCommand(targetServerConfig, clientConfig)
			verbose("Command executed successfully")
		} else {
			// For file-based clients, read existing config and merge
			verbose(`Reading configuration for client: ${client}`)
			const config = readConfig(client)

			verbose("Updating client configuration...")
			config.mcpServers[serverName] = serverConfig
			verbose("Writing updated configuration...")
			writeConfig(config, client)
			verbose("Configuration successfully written")
		}

		console.log(
			chalk.green(`✓ ${qualifiedName} successfully installed for ${client}`),
		)
		verbose("Prompting for client restart...")
		await promptForRestart(client)
		verbose("Installation process completed")
		process.exit(0)
	} catch (error) {
		spinner.fail(`Failed to install ${qualifiedName}`)
		verbose(
			`Installation error: ${error instanceof Error ? error.stack : JSON.stringify(error)}`,
		)
		if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`))
		} else {
			console.error(
				chalk.red("An unexpected error occurred during installation"),
			)
		}
		process.exit(1)
	}
}
