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

import type { RegistryServer } from "./types/registry"
import type { ConnectionDetails } from "./types/registry"
import type { ValidClient } from "./constants"
import type { ConfiguredServer } from "./types/registry"
import {
	collectConfigValues,
	promptForRestart,
	normalizeServerId,
} from "./utils"
import { readConfig, writeConfig } from "./config"
import { resolvePackage } from "./registry"
import chalk from "chalk"

function chooseConnection(server: RegistryServer): ConnectionDetails {
	if (!server.connections?.length) {
		throw new Error("No connection configuration found")
	}

	const priorityOrder = ["ws", "npx", "uvx", "docker"]

	for (const priority of priorityOrder) {
		const connection = server.connections.find((conn) =>
			priority === "ws"
				? conn.type === "ws"
				: conn.type === "stdio" && conn.stdioFunction?.startsWith(priority),
		)
		if (connection) return connection
	}

	/* fallback to first available connection if non available */
	return server.connections[0]
}

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
	const server = await resolvePackage(qualifiedName)
	const connection = chooseConnection(server)

	/* inform users of remote server installation */
	const remote = server.connections.some(
		(conn) => conn.type === "ws" && "deploymentUrl" in conn,
	)
	if (remote) {
		console.log(
			chalk.blue(
				`Installing remote server. Please ensure you trust the server author, especially when sharing sensitive data.\nFor information on Smithery's data policy, please visit: ${chalk.underline("https://smithery.ai/docs/data-policy")}`,
			),
		)
	}

	/* collect config values from user */
	const configValues = await collectConfigValues(connection)
	const serverConfig = formatServerConfig(qualifiedName, configValues)

	/* read config from client */
	const config = readConfig(client)
	const normalizedName =
		normalizeServerId(
			qualifiedName,
		) /* normaise because some clients doesn't do well slashes */
	config.mcpServers[normalizedName] = serverConfig
	writeConfig(config, client)
	console.log(
		chalk.green(`${qualifiedName} successfully installed for ${client}`),
	)
	await promptForRestart(client)
}
