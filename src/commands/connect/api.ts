import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import type {
	Connection,
	ConnectionsListResponse,
} from "@smithery/api/resources/beta/connect/connections.js"
import { createSmitheryClient } from "../../lib/smithery-client"
import { getNamespace as getStoredNamespace } from "../../utils/smithery-settings"

export type { Connection, ConnectionsListResponse }

export interface ToolInfo extends Tool {
	connectionId: string
	connectionName: string
}

export { createSmitheryClient as createSmitheryClient }

export async function getCurrentNamespace(): Promise<string> {
	// First check stored namespace from settings
	const stored = await getStoredNamespace()
	if (stored) {
		return stored
	}

	// Fall back to first namespace from API
	const client = await createSmitheryClient()
	const { namespaces } = await client.namespaces.list()

	if (namespaces.length === 0) {
		throw new Error(
			"No namespace set and no namespaces found. Run 'smithery namespace use <name>' or create one at smithery.ai first.",
		)
	}

	return namespaces[0].name
}

export async function listConnections(
	namespace: string,
): Promise<Connection[]> {
	const client = await createSmitheryClient()
	const data = await client.beta.connect.connections.list(namespace)
	return data.connections
}

export async function mcpRpc(
	namespace: string,
	connectionId: string,
	method: string,
	params: unknown = {},
): Promise<unknown> {
	const client = await createSmitheryClient()
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

export async function createConnection(
	namespace: string,
	mcpUrl: string,
	options: { name?: string } = {},
): Promise<Connection> {
	const client = await createSmitheryClient()
	return client.beta.connect.connections.create(namespace, {
		mcpUrl,
		name: options.name,
	})
}

export async function deleteConnection(
	namespace: string,
	connectionId: string,
): Promise<void> {
	const client = await createSmitheryClient()
	await client.beta.connect.connections.delete(connectionId, { namespace })
}

export async function getConnection(
	namespace: string,
	connectionId: string,
): Promise<Connection> {
	const client = await createSmitheryClient()
	return client.beta.connect.connections.get(connectionId, { namespace })
}
