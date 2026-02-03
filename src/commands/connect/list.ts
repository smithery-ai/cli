import {
	getCurrentNamespace,
	listConnections,
	listToolsForConnection,
} from "./api"
import { outputJson } from "./output"

interface ServersOutput {
	servers: Array<{
		id: string
		name: string
		status?: string
		toolCount?: number
	}>
	help: string
}

export async function listServers(options: {
	namespace?: string
}): Promise<void> {
	const namespace = options.namespace ?? (await getCurrentNamespace())

	const connections = await listConnections(namespace)

	if (connections.length === 0) {
		outputJson({
			servers: [],
			help: "No servers connected. Use 'smithery connect add <mcp-url>' to add one.",
		})
		return
	}

	const serversWithCounts = await Promise.all(
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

	const output: ServersOutput = {
		servers: serversWithCounts,
		help: "smithery connect tools <server> - List tools for a specific server",
	}
	outputJson(output)
}
