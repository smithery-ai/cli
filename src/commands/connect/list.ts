import { ConnectSession } from "./api"
import { outputJson } from "./output"

export async function listServers(options: {
	namespace?: string
	limit?: string
	cursor?: string
}): Promise<void> {
	const session = await ConnectSession.create(options.namespace)
	const limit = options.limit ? Number.parseInt(options.limit, 10) : undefined
	const { connections, nextCursor } = await session.listConnections({
		limit,
		cursor: options.cursor,
	})

	if (connections.length === 0) {
		outputJson({
			servers: [],
			help: "No servers connected. Use 'smithery connect add <mcp-url>' to add one.",
		})
		return
	}

	const output: Record<string, unknown> = {
		servers: connections.map((conn) => ({
			id: conn.connectionId,
			name: conn.name,
			mcpUrl: conn.mcpUrl,
			status: conn.status?.state ?? "unknown",
		})),
		help: "smithery connect tools <server> - List tools for a specific server",
	}

	if (nextCursor) {
		output.nextCursor = nextCursor
	}

	outputJson(output)
}
