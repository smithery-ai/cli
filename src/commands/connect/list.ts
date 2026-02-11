import { outputTable } from "../../utils/output"
import { ConnectSession } from "./api"

export async function listServers(options: {
	namespace?: string
	limit?: string
	cursor?: string
	json?: boolean
}): Promise<void> {
	const session = await ConnectSession.create(options.namespace)
	const limit = options.limit ? Number.parseInt(options.limit, 10) : undefined
	const { connections, nextCursor } = await session.listConnections({
		limit,
		cursor: options.cursor,
	})

	const data = connections.map((conn) => ({
		id: conn.connectionId,
		name: conn.name,
		mcpUrl: conn.mcpUrl,
		status: conn.status?.state ?? "unknown",
	}))

	outputTable({
		data,
		columns: [
			{ key: "id", header: "ID" },
			{ key: "name", header: "NAME" },
			{ key: "mcpUrl", header: "URL" },
			{ key: "status", header: "STATUS" },
		],
		json: options.json ?? false,
		jsonData: {
			servers: data,
			...(nextCursor ? { nextCursor } : {}),
		},
		pagination: { nextCursor },
		tip:
			data.length === 0
				? "No servers connected. Use 'smithery mcp add <mcp-url>' to add one."
				: "Use smithery tools list <connection> to list tools for a connection.",
	})
}
