import {
	getPrimaryNamespace,
	listConnections,
	listToolsForConnection,
} from "./api"
import { outputJson } from "./output"

interface ListOutput {
	tools: Array<{
		id: string
		name: string
		connection: string
		description?: string
		inputSchema?: unknown
	}>
	help: string
}

interface ConnectionsOutput {
	connections: Array<{
		id: string
		name: string
		status?: string
		toolCount?: number
	}>
	help: string
}

export async function listTools(
	connection: string | undefined,
	options: { namespace?: string },
): Promise<void> {
	const namespace = options.namespace ?? (await getPrimaryNamespace())

	// List all connections
	const connections = await listConnections(namespace)

	if (connections.length === 0) {
		outputJson({
			connections: [],
			help: "No connections found. Add connections at smithery.ai first.",
		})
		return
	}

	// If no connection specified, list all connections with their tool counts
	if (!connection) {
		const connectionsWithCounts = await Promise.all(
			connections.map(async (conn) => {
				const tools = await listToolsForConnection(namespace, conn)
				return {
					id: conn.connectionId,
					name: conn.name,
					status: conn.status?.state ?? "unknown",
					toolCount: tools.length,
				}
			}),
		)

		const output: ConnectionsOutput = {
			connections: connectionsWithCounts,
			help: "smithery tools list <connection> - List tools for a specific connection",
		}
		outputJson(output)
		return
	}

	// Find the specified connection
	const targetConnection = connections.find(
		(c) =>
			c.connectionId === connection ||
			c.name.toLowerCase() === connection.toLowerCase(),
	)

	if (!targetConnection) {
		outputJson({
			tools: [],
			error: `Connection "${connection}" not found`,
			available: connections.map((c) => c.connectionId),
			help: "smithery tools list - List all connections",
		})
		return
	}

	// List tools for the specified connection
	const tools = await listToolsForConnection(namespace, targetConnection)

	const output: ListOutput = {
		tools: tools.map((t) => ({
			id: `${t.connectionId}/${t.name}`,
			name: t.name,
			connection: t.connectionName,
			description: t.description,
			inputSchema: t.inputSchema,
		})),
		help: "smithery tools call <id> '<args>'",
	}

	outputJson(output)
}
