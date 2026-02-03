import { ConnectSession } from "./api"
import { outputJson } from "./output"

interface ServersOutput {
	servers: Array<{
		id: string
		name: string
		status?: string
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

	const output: ServersOutput = {
		servers: connections.map((conn) => ({
			id: conn.connectionId,
			name: conn.name,
			status: conn.status?.state ?? "unknown",
		})),
		help: "smithery connect tools <server> - List tools for a specific server",
	}
	outputJson(output)
}
