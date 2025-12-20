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
import {
	ensureBundleInstalled,
	getBundleUserConfigSchema,
} from "../lib/bundle-manager"
import { getConfig, saveConfig } from "../lib/keychain"
import { verbose } from "../lib/logger"
import { ResolveServerSource, resolveServer } from "../lib/registry"
import type { ServerConfig } from "../types/registry"
import { checkAnalyticsConsent } from "../utils/analytics"
import { promptForRestart } from "../utils/client"
import { promptForExistingConfig } from "../utils/command-prompts"
import { readConfig, runConfigCommand, writeConfig } from "../utils/mcp-config"
import {
	checkAndNotifyRemoteServer,
	ensureBunInstalled,
	ensureUVInstalled,
} from "../utils/runtime"
import {
	collectConfigValues,
	formatServerConfig,
	getServerName,
} from "../utils/session-config"

/**
 * Installs and configures a Smithery server for a specified client.
 * Prompts for config values if config not given OR saved config not found in keychain
 *
 * @param {string} qualifiedName - The qualified name of the server to install
 * @param {ValidClient} client - The client to install the server for
 * @param {Record<string, unknown>} [configValues] - Optional configuration values for the server (from --config flag)
 * @returns {Promise<void>} A promise that resolves when installation is complete
 * @throws Will throw an error if installation fails
 */
export async function installServer(
	qualifiedName: string,
	client: ValidClient,
	configValues: ServerConfig,
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
			undefined, // @TODO: how do we handle no api key here
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

		checkAndNotifyRemoteServer(server)

		// Check for existing config in keychain
		const existingConfig = await getConfig(qualifiedName)
		let finalConfig: ServerConfig

		if (existingConfig && Object.keys(configValues).length === 0) {
			// Config exists and no --config flag provided
			spinner.stop()
			const useExisting = await promptForExistingConfig()
			spinner.start()

			if (useExisting) {
				finalConfig = existingConfig
				verbose("Using existing configuration from keychain")
			} else {
				// Proceed with normal config collection
				// Get schema based on server connection type
				let configSchema = connection.configSchema || undefined
				if (connection.bundleUrl) {
					// Bundle-based server: get schema from bundle manifest
					verbose("Downloading bundle to extract user_config schema...")
					const bundleDir = await ensureBundleInstalled(
						qualifiedName,
						connection.bundleUrl,
					)
					const bundleSchema = getBundleUserConfigSchema(bundleDir)
					if (bundleSchema) {
						configSchema = bundleSchema
					}
				}

				// Create connection with schema for prompting
				const connectionWithSchema = {
					...connection,
					configSchema,
				}
				finalConfig = await collectConfigValues(connectionWithSchema, {})
			}
		} else if (Object.keys(configValues).length > 0) {
			// --config flag provided, use it (overwrites existing)
			finalConfig = configValues
			verbose("Using configuration from --config flag")
		} else {
			// No existing config, collect normally
			// Get schema based on server connection type
			let configSchema = connection.configSchema || undefined
			if (connection.bundleUrl) {
				// Bundle-based server: get schema from bundle manifest
				verbose("Downloading bundle to extract user_config schema...")
				const bundleDir = await ensureBundleInstalled(
					qualifiedName,
					connection.bundleUrl,
				)
				const bundleSchema = getBundleUserConfigSchema(bundleDir)
				if (bundleSchema) {
					configSchema = bundleSchema
				}
			}

			// Create connection with schema for prompting
			const connectionWithSchema = {
				...connection,
				configSchema,
			}
			finalConfig = await collectConfigValues(connectionWithSchema, {})
		}

		verbose(`Config values: ${JSON.stringify(finalConfig, null, 2)}`)

		// Save config to keychain
		if (Object.keys(finalConfig).length > 0) {
			verbose("Saving configuration to keychain...")
			await saveConfig(qualifiedName, finalConfig)
			verbose("Configuration successfully saved to keychain")
		}

		verbose("Formatting server configuration...")
		const serverConfig = formatServerConfig(
			qualifiedName,
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
