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
import { readConfig, writeConfig } from "../client-config"
import type { ValidClient } from "../constants"
import { verbose } from "../logger"
import { resolvePackage } from "../registry"
import type { ConfiguredServer, ServerConfig } from "../types/registry"
import {
	checkUVInstalled,
	isUVRequired,
	promptForUVInstall,
	checkBunInstalled,
	promptForBunInstall,
	isBunRequired,
} from "../utils/runtime"
import {
	chooseConnection,
	collectConfigValues,
	getServerName,
} from "../utils/config"
import { checkAnalyticsConsent } from "../utils/analytics"
import { promptForRestart } from "../utils/client"

function formatServerConfig(
	qualifiedName: string,
	userConfig: ServerConfig,
	apiKey?: string,
	configNeeded: boolean = true // whether config flag is needed
): ConfiguredServer {
	// Base arguments for npx command
	const npxArgs = ["-y", "@smithery/cli@latest", "run", qualifiedName]

	// Always add API key if provided
	if (apiKey) {
		npxArgs.push("--key", apiKey)
	}

	if ((!apiKey || configNeeded)) {
		/* double stringify config to make it shell-safe */
		const encodedConfig = JSON.stringify(JSON.stringify(userConfig))
		npxArgs.push("--config", encodedConfig)
	}

	// Use cmd /c for Windows platforms
	if (process.platform === "win32") {
		return {
			command: "cmd",
			args: ["/c", "npx", ...npxArgs],
		}
	}

	// Default for non-Windows platforms
	return {
		command: "npx",
		args: npxArgs,
	}
}

/**
 * Installs and configures a Smithery server for a specified client. 
 * Prompts for config values if config not given OR saved config not valid
 * 
 * @param {string} qualifiedName - The fully qualified name of the server package to install
 * @param {ValidClient} client - The client to install the server for
 * @param {Record<string, unknown>} [configValues] - Optional configuration values for the server
 * @param {string} [apiKey] - Optional API key to fetch saved config
 * @returns {Promise<void>} A promise that resolves when installation is complete
 * @throws Will throw an error if installation fails
 */
export async function installServer(
	qualifiedName: string,
	client: ValidClient,
	configValues?: Record<string, unknown>,
	apiKey?: string // api key is essentially a longer term goal to abstract away user passed config
): Promise<void> {
	verbose(`Starting installation of ${qualifiedName} for client ${client}`)

	/* start resolving in background */
	verbose(`Resolving package: ${qualifiedName}`)
	const serverPromise = resolvePackage(qualifiedName)

	// Add error handling around analytics check
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
		verbose("Awaiting package resolution...")
		const server = await serverPromise
		verbose(`Package resolved successfully: ${server.qualifiedName}`)
		spinner.succeed(`Successfully resolved ${qualifiedName}`)

		verbose("Choosing connection type...")
		const connection = chooseConnection(server)
		verbose(`Selected connection: ${JSON.stringify(connection, null, 2)}`)

		/* Check if UV is required and install if needed */
		if (isUVRequired(connection)) {
			verbose("UV installation check required")
			const uvInstalled = await checkUVInstalled()
			if (!uvInstalled) {
				const installed = await promptForUVInstall()
				if (!installed) {
					console.warn(
						chalk.yellow(
							"UV is not installed. The server might fail to launch.",
						),
					)
				}
			}
		}

		/* Check if Bun is required and install if needed */
		if (isBunRequired(connection)) {
			verbose("Bun installation check required")
			const bunInstalled = await checkBunInstalled()
			if (!bunInstalled) {
				const installed = await promptForBunInstall()
				if (!installed) {
					console.warn(
						chalk.yellow(
							"Bun is not installed. The server might fail to launch.",
						),
					)
				}
			}
		}

		/* inform users of remote server installation */
		const remote =
			server.connections.some(
				(conn) => conn.type === "ws" && "deploymentUrl" in conn,
			) && server.remote !== false

		if (remote) {
			verbose("Remote server detected, showing security notice")
			console.log(
				chalk.blue(
					`Installing remote server. Please ensure you trust the server author, especially when sharing sensitive data.\nFor information on Smithery's data policy, please visit: ${chalk.underline("https://smithery.ai/docs/data-policy")}`,
				),
			)
		}

		/* collect config values from user or use provided config */
		verbose(
			configValues
				? "Using provided config values" // provided values always override others
				: "Collecting config values", // from user or from saved config
		)
		const { configValues: collectedConfigValues, isSavedConfig } = await collectConfigValues(
			connection, 
			configValues,
			apiKey, 
			qualifiedName
		)
		verbose(`Config values: ${JSON.stringify(collectedConfigValues, null, 2)}`)
		verbose(`Is from saved config: ${isSavedConfig}`)

		verbose("Formatting server configuration...")
		const serverConfig = formatServerConfig(
			qualifiedName,
			collectedConfigValues,
			apiKey,
			!isSavedConfig // Only include config if saved config not valid
		)
		verbose(`Formatted server config: ${JSON.stringify(serverConfig, null, 2)}`)

		/* read config from client */
		verbose(`Reading configuration for client: ${client}`)
		const config = readConfig(client)
		verbose("Normalizing server ID...")
		const serverName = getServerName(qualifiedName)
		verbose(`Normalized server ID: ${serverName}`)

		verbose("Updating client configuration...")
		config.mcpServers[serverName] = serverConfig
		verbose("Writing updated configuration...")
		writeConfig(config, client)
		verbose("Configuration successfully written")

		console.log(
			chalk.green(`${qualifiedName} successfully installed for ${client}`),
		)
		verbose("Prompting for client restart...")
		await promptForRestart(client)
		verbose("Installation process completed")
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
