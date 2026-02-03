import chalk from "chalk"
import { ConnectSession } from "./api"
import { outputJson } from "./output"

export async function removeServer(
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

	try {
		await session.deleteConnection(targetConnection.connectionId)
		outputJson({
			success: true,
			removed: targetConnection.connectionId,
		})
	} catch (error) {
		console.error(
			chalk.red(
				`Failed to remove server: ${error instanceof Error ? error.message : String(error)}`,
			),
		)
		process.exit(1)
	}
}
