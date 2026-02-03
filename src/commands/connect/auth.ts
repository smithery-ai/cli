import chalk from "chalk"
import { ConnectSession } from "./api"
import { outputJson } from "./output"

export async function authServer(
	serverId: string,
	options: { namespace?: string },
): Promise<void> {
	const session = await ConnectSession.create(options.namespace)
	const connections = await session.listConnections()

	// Find the connection by ID or name
	const targetConnection = connections.find(
		(c) =>
			c.connectionId === serverId ||
			c.name.toLowerCase() === serverId.toLowerCase(),
	)

	if (!targetConnection) {
		console.error(chalk.red(`Server "${serverId}" not found.`))
		console.error(
			chalk.gray(
				`Available servers: ${connections.map((c) => c.connectionId).join(", ")}`,
			),
		)
		process.exit(1)
	}

	// Get fresh connection status
	const connection = await session.getConnection(targetConnection.connectionId)

	if (connection.status?.state === "connected") {
		console.log(chalk.green(`Server "${connection.name}" is already connected.`))
		return
	}

	if (connection.status?.state === "auth_required") {
		const authUrl =
			"authorizationUrl" in connection.status
				? connection.status.authorizationUrl
				: undefined

		if (authUrl) {
			outputJson({
				status: "auth_required",
				authUrl,
				help: "Complete authentication in browser",
			})
		} else {
			console.error(
				chalk.red("Server requires authentication but no auth URL available."),
			)
			process.exit(1)
		}
		return
	}

	if (connection.status?.state === "error") {
		const message =
			"message" in connection.status ? connection.status.message : "Unknown error"
		console.error(chalk.red(`Server error: ${message}`))
		process.exit(1)
	}

	// Unknown status
	console.log(chalk.yellow("Server status: unknown"))
}
