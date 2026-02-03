import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { Smithery } from "@smithery/api/client.js"
import type {
	Connection,
	ConnectionsListResponse,
} from "@smithery/api/resources/beta/connect/connections.js"
import { getApiKey } from "../../utils/smithery-settings"

export type { Connection, ConnectionsListResponse }

export interface ToolInfo extends Tool {
	connectionId: string
	connectionName: string
}

async function getClient(): Promise<Smithery> {
	const apiKey = await getApiKey()
	if (!apiKey) {
		throw new Error("No API key found. Run 'smithery login' to authenticate.")
	}
	return new Smithery({ apiKey })
}

export async function getPrimaryNamespace(): Promise<string> {
	const client = await getClient()
	const { namespaces } = await client.namespaces.list()

	if (namespaces.length === 0) {
		throw new Error("No namespaces found. Create one at smithery.ai first.")
	}

	return namespaces[0].name
}

export async function listConnections(
	namespace: string,
): Promise<Connection[]> {
	const client = await getClient()
	const data = await client.beta.connect.connections.list(namespace)
	return data.connections
}

export async function mcpRpc(
	namespace: string,
	connectionId: string,
	method: string,
	params: unknown = {},
): Promise<unknown> {
	const client = await getClient()
	const response = await client.beta.connect.mcp.call(
		connectionId,
		{ namespace },
		{
			body: {
				jsonrpc: "2.0",
				id: Math.floor(Math.random() * 1e9),
				method,
				params,
			},
		},
	)

	return response.result
}

export async function listToolsForConnection(
	namespace: string,
	connection: Connection,
): Promise<ToolInfo[]> {
	try {
		const result = (await mcpRpc(
			namespace,
			connection.connectionId,
			"tools/list",
		)) as {
			tools?: Tool[]
		}

		return (result?.tools ?? []).map((tool) => ({
			...tool,
			connectionId: connection.connectionId,
			connectionName: connection.name,
		}))
	} catch {
		// Connection may be disconnected or not support tools
		return []
	}
}

export async function callTool(
	namespace: string,
	connectionId: string,
	toolName: string,
	args: Record<string, unknown>,
): Promise<unknown> {
	return mcpRpc(namespace, connectionId, "tools/call", {
		name: toolName,
		arguments: args,
	})
}
