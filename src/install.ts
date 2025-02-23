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
import { readConfig, writeConfig } from "./client-config"
import { resolvePackage } from "./registry"
import chalk from "chalk"

function chooseConnection(server: RegistryServer): ConnectionDetails {
	if (!server.connections?.length) {
		throw new Error("No connection configuration found")
	}

	/* Prioritise WebSocket connection */
	const wsConnection = server.connections.find(conn => conn.type === "ws")
	if (wsConnection) return wsConnection

	/* For stdio connections, prioritize published ones first */
	const stdioConnections = server.connections.filter(conn => conn.type === "stdio")
	const priorityOrder = ["npx", "uvx", "docker"]

	/* Try published connections first */
	for (const priority of priorityOrder) {
		const connection = stdioConnections.find(
			conn => conn.stdioFunction?.startsWith(priority) && conn.published
		)
		if (connection) return connection
	}

	/* Try unpublished connections */
	for (const priority of priorityOrder) {
		const connection = stdioConnections.find(
			conn => conn.stdioFunction?.startsWith(priority)
		)
		if (connection) return connection
	}

	/* Fallback to first available connection if none match criteria */
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
		) /* normalise because some clients don't do well with slashes */
	config.mcpServers[normalizedName] = serverConfig
	writeConfig(config, client)
	console.log(
		chalk.green(`${qualifiedName} successfully installed for ${client}`),
	)
	await promptForRestart(client)
}
