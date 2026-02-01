import "../utils/suppress-punycode-warning"
import { APIConnectionTimeoutError } from "@smithery/api"
import chalk from "chalk"
import ora from "ora"
import type { ValidClient } from "../config/clients"
import { getClientConfiguration } from "../config/clients"
import {
	formatServerConfig,
	readConfig,
	runConfigCommand,
	writeConfig,
} from "../lib/client-config-io"
import { saveConfig } from "../lib/keychain"
import { verbose } from "../lib/logger"
import { resolveServer } from "../lib/registry"
import type { ServerConfig } from "../types/registry"
import { checkAnalyticsConsent } from "../utils/analytics"
import { parseQualifiedName } from "../utils/cli-utils"
import { promptForRestart, showPostInstallHint } from "../utils/client"
import { resolveTransport } from "../utils/install/transport"
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
		const { server, connection } = await resolveServer(
			parseQualifiedName(qualifiedName),
		)
		spinner.succeed(
			chalk.dim(`Successfully resolved ${chalk.cyan(qualifiedName)}`),
		)

		// Resolve transport type (single source of truth)
		const transport = resolveTransport(connection, client)

		// Check for required runtimes and install if needed (only for stdio connections)
		if (connection.type === "stdio") {
			await ensureUVInstalled(connection)
			await ensureBunInstalled(connection)
		}

		// Notify user if remote server
		checkAndNotifyRemoteServer(server)

		/* resolve server configuration - only for STDIO since HTTP uses OAuth (handled by client or mcp-remote) */
		let finalConfig: ServerConfig = {}
		if (transport.needsUserConfig) {
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
			verbose(
				"Skipping config collection - OAuth handled by client or mcp-remote",
			)
		}

		/* Install for client */
		const serverConfig = formatServerConfig(qualifiedName, transport.type)

		verbose(`Formatted server config: ${JSON.stringify(serverConfig, null, 2)}`)
		const serverName = qualifiedName.includes("/")
			? qualifiedName.substring(qualifiedName.lastIndexOf("/") + 1)
			: qualifiedName

		if (clientConfig.install.method === "command") {
			// For command-based clients, execute command directly for this server only
			verbose("Command-based client detected, executing command directly...")
			const targetServerConfig = {
				mcpServers: {
					[serverName]: serverConfig,
				},
			}
			runConfigCommand(targetServerConfig, clientConfig)
		} else {
			// For file-based clients, read existing config and merge
			const config = readConfig(client)
			config.mcpServers[serverName] = serverConfig
			writeConfig(config, client)
		}

		console.log()
		console.log(
			chalk.green(`✓ ${qualifiedName} successfully installed for ${client}`),
		)
		showPostInstallHint(client)
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
