import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { Smithery } from "@smithery/api/client.js"
import { getApiKey } from "../../utils/smithery-settings"

const CONNECT_URL = process.env.SMITHERY_CONNECT_URL || "https://smithery.run"

export interface Connection {
	connectionId: string
	name: string
	mcpUrl: string
	status?: {
		state: "connected" | "auth_required" | "error"
		message?: string
		authorizationUrl?: string
	}
	serverInfo?: {
		name: string
		version: string
	}
}

export interface ConnectionsListResponse {
	connections: Connection[]
	nextCursor: string | null
}

export interface ToolInfo extends Tool {
	connectionId: string
	connectionName: string
}

async function getAuthHeaders(): Promise<HeadersInit> {
	const apiKey = await getApiKey()
	if (!apiKey) {
		throw new Error("No API key found. Run 'smithery login' to authenticate.")
	}
	return {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	}
}

export async function getPrimaryNamespace(): Promise<string> {
	const apiKey = await getApiKey()
	if (!apiKey) {
		throw new Error("No API key found. Run 'smithery login' to authenticate.")
	}

	const client = new Smithery({ apiKey })
	const { namespaces } = await client.namespaces.list()

	if (namespaces.length === 0) {
		throw new Error("No namespaces found. Create one at smithery.ai first.")
	}

	return namespaces[0].name
}

export async function listConnections(
	namespace: string,
): Promise<Connection[]> {
	const headers = await getAuthHeaders()
	const response = await fetch(`${CONNECT_URL}/${namespace}`, {
		method: "GET",
		headers,
	})

	if (!response.ok) {
		const text = await response.text()
		throw new Error(`Failed to list connections: ${response.status} ${text}`)
	}

	const data = (await response.json()) as ConnectionsListResponse
	return data.connections
}

export async function mcpRpc(
	namespace: string,
	connectionId: string,
	method: string,
	params: unknown = {},
): Promise<unknown> {
	const headers = await getAuthHeaders()
	const response = await fetch(
		`${CONNECT_URL}/${namespace}/${connectionId}/mcp`,
		{
			method: "POST",
			headers,
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: Math.floor(Math.random() * 1e9),
				method,
				params,
			}),
		},
	)

	if (!response.ok) {
		const text = await response.text()
		throw new Error(`MCP call failed: ${response.status} ${text}`)
	}

	const data = (await response.json()) as {
		result?: unknown
		error?: { code: number; message: string }
	}

	if (data.error) {
		throw new Error(`MCP error: ${data.error.message}`)
	}

	return data.result
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
