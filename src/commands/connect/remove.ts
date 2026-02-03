import chalk from "chalk"
import { deleteConnection, getCurrentNamespace, listConnections } from "./api"
import { outputJson } from "./output"

export async function removeServer(
	serverId: string,
	options: { namespace?: string },
): Promise<void> {
	const namespace = options.namespace ?? (await getCurrentNamespace())

	// Find the connection by ID or name
	const connections = await listConnections(namespace)
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
		await deleteConnection(namespace, targetConnection.connectionId)
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
