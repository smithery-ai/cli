import { ConnectSession } from "./api"
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
	const session = await ConnectSession.create(options.namespace)
	const connections = await session.listConnections()

	if (connections.length === 0) {
		outputJson({
			servers: [],
			help: "No servers connected. Use 'smithery connect add <mcp-url>' to add one.",
		})
		return
	}

	const serversWithCounts = await Promise.all(
		connections.map(async (conn) => {
			const tools = await session.listToolsForConnection(conn)
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
