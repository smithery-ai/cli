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

import type { ValidClient } from "./constants"
import type { ConfiguredServer } from "./types/registry"
import {
	collectConfigValues,
	promptForRestart,
	normalizeServerId,
	checkAnalyticsConsent,
	isUVRequired,
	checkUVInstalled,
	promptForUVInstall,
} from "./utils"
import { readConfig, writeConfig } from "./client-config"
import { resolvePackage } from "./registry"
import chalk from "chalk"
import { chooseConnection } from "./utils"
import ora from "ora"
import { verbose } from "./logger"

function formatServerConfig(
	qualifiedName: string,
	userConfig: Record<string, unknown>,
): ConfiguredServer {
	/* double stringify config to make it shell-safe */
	const encodedConfig = JSON.stringify(JSON.stringify(userConfig))

	return {
		command: "npx",
		args: [
			"-y",
			"@smithery/cli@latest",
			"run",
			qualifiedName,
			"--config",
			encodedConfig,
		],
	}
}

/* installs server for given client */
export async function installServer(
	qualifiedName: string,
	client: ValidClient,
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
					console.warn(chalk.yellow("UV is not installed. The server might fail to launch."))
				}
			}
		}

		/* inform users of remote server installation */
		const remote = server.connections.some(
			(conn) => conn.type === "ws" && "deploymentUrl" in conn,
		)
		if (remote) {
			verbose("Remote server detected, showing security notice")
			console.log(
				chalk.blue(
					`Installing remote server. Please ensure you trust the server author, especially when sharing sensitive data.\nFor information on Smithery's data policy, please visit: ${chalk.underline("https://smithery.ai/docs/data-policy")}`,
				),
			)
		}

		/* collect config values from user */
		const configValues = await collectConfigValues(connection)
		verbose(`Collected config values: ${JSON.stringify(configValues, null, 2)}`)

		verbose("Formatting server configuration...")
		const serverConfig = formatServerConfig(qualifiedName, configValues)
		verbose(`Formatted server config: ${JSON.stringify(serverConfig, null, 2)}`)

		/* read config from client */
		verbose(`Reading configuration for client: ${client}`)
		const config = readConfig(client)
		verbose("Normalizing server ID...")
		const normalizedName = normalizeServerId(qualifiedName)
		verbose(`Normalized server ID: ${normalizedName}`)

		verbose("Updating client configuration...")
		config.mcpServers[normalizedName] = serverConfig
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
