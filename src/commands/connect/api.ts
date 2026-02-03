import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import type {
	Connection,
	ConnectionsListResponse,
} from "@smithery/api/resources/beta/connect/connections.js"
import { createSmitheryClient } from "../../lib/smithery-client"
import {
	getNamespace as getStoredNamespace,
	setNamespace,
} from "../../utils/smithery-settings"

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
		// Auto-create a default namespace
		const { name } = await client.namespaces.create()
		await setNamespace(name)
		return name
	}

	// Use the first available namespace and persist it
	const defaultNamespace = namespaces[0].name
	await setNamespace(defaultNamespace)
	return defaultNamespace
}

export async function listConnections(
	namespace: string,
): Promise<Connection[]> {
	const client = await createSmitheryClient()
	const data = await client.beta.connect.connections.list(namespace)
	return data.connections
}

async function getMcpClient(
	namespace: string,
	connectionId: string,
): Promise<Client> {
	const smitheryClient = await createSmitheryClient()
	const url = new URL(
		`/connect/${namespace}/${connectionId}/mcp`,
		smitheryClient.baseURL,
	).href

	const transport = new StreamableHTTPClientTransport(new URL(url), {
		requestInit: {
			headers: {
				Authorization: `Bearer ${smitheryClient.apiKey}`,
			},
		},
	})

	const mcpClient = new Client({ name: "smithery-cli", version: "1.0.0" })
	await mcpClient.connect(transport)
	return mcpClient
}

export async function listToolsForConnection(
	namespace: string,
	connection: Connection,
): Promise<ToolInfo[]> {
	try {
		const mcpClient = await getMcpClient(namespace, connection.connectionId)
		const { tools } = await mcpClient.listTools()

		return (tools ?? []).map((tool) => ({
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
	const mcpClient = await getMcpClient(namespace, connectionId)
	return mcpClient.callTool({
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
