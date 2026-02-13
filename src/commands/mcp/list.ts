import { getClientConfiguration } from "../../config/clients"
import { fatal } from "../../lib/cli-error"
import { readConfig } from "../../lib/client-config-io"
import { isJsonMode, outputTable } from "../../utils/output"
import { ConnectSession } from "./api"

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
		json: isJsonMode(),
		jsonData: {
			servers: data,
			total: data.length,
			hasMore: !!nextCursor,
			...(nextCursor ? { nextCursor } : {}),
		},
		pagination: { nextCursor, total: data.length },
		tip:
			data.length === 0
				? "No servers connected. Use 'smithery mcp add <mcp-url>' to add one."
				: "Use smithery tool list <id> to view tools for a connection.",
	})
}

/**
 * List MCP servers installed in a specific AI client's config.
 */
export async function listClientServers(client: string): Promise<void> {
	const isJson = isJsonMode()

	const configTarget = getClientConfiguration(client)
	if (configTarget.install.method === "command") {
		fatal(`Listing servers is not supported for ${client}`)
	}

	const config = readConfig(client)
	const servers = Object.keys(config.mcpServers).sort()

	const data = servers.map((name) => ({ name }))

	outputTable({
		data,
		columns: [{ key: "name", header: "NAME" }],
		json: isJson,
		jsonData: { client, servers },
		tip:
			data.length === 0
				? `No servers installed for ${client}. Use smithery mcp add <url> --client ${client} to install one.`
				: `Use smithery mcp remove <name> --client ${client} to uninstall.`,
	})
}
