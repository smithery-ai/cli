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

export { createSmitheryClient }

// Use Awaited to get the concrete type from createSmitheryClient
type SmitheryClient = Awaited<ReturnType<typeof createSmitheryClient>>

/**
 * Session for Connect operations that reuses clients within a command.
 * Create one session per command to avoid redundant client creation.
 */
export class ConnectSession {
	private mcpClients = new Map<string, Client>()

	constructor(
		private smitheryClient: SmitheryClient,
		private namespace: string,
	) {}

	static async create(namespace?: string): Promise<ConnectSession> {
		const client = await createSmitheryClient()
		const ns = namespace ?? (await getCurrentNamespace())
		return new ConnectSession(client, ns)
	}

	async listConnections(): Promise<Connection[]> {
		const all: Connection[] = []
		let cursor: string | undefined

		do {
			const data = await this.smitheryClient.beta.connect.connections.list(
				this.namespace,
				{ cursor },
			)
			all.push(...data.connections)
			cursor = data.nextCursor ?? undefined
		} while (cursor)

		return all
	}

	private async getMcpClient(connectionId: string): Promise<Client> {
		const cached = this.mcpClients.get(connectionId)
		if (cached) {
			return cached
		}

		const url = new URL(
			`/connect/${this.namespace}/${connectionId}/mcp`,
			this.smitheryClient.baseURL,
		).href

		const transport = new StreamableHTTPClientTransport(new URL(url), {
			requestInit: {
				headers: {
					Authorization: `Bearer ${this.smitheryClient.apiKey}`,
				},
			},
		})

		const mcpClient = new Client({ name: "smithery-cli", version: "1.0.0" })
		await mcpClient.connect(transport)
		this.mcpClients.set(connectionId, mcpClient)
		return mcpClient
	}

	async listToolsForConnection(connection: Connection): Promise<ToolInfo[]> {
		try {
			const mcpClient = await this.getMcpClient(connection.connectionId)
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

	async callTool(
		connectionId: string,
		toolName: string,
		args: Record<string, unknown>,
	): Promise<unknown> {
		const mcpClient = await this.getMcpClient(connectionId)
		return mcpClient.callTool({
			name: toolName,
			arguments: args,
		})
	}

	async createConnection(
		mcpUrl: string,
		options: { name?: string } = {},
	): Promise<Connection> {
		return this.smitheryClient.beta.connect.connections.create(this.namespace, {
			mcpUrl,
			name: options.name,
		})
	}

	async deleteConnection(connectionId: string): Promise<void> {
		await this.smitheryClient.beta.connect.connections.delete(connectionId, {
			namespace: this.namespace,
		})
	}

	async getConnection(connectionId: string): Promise<Connection> {
		return this.smitheryClient.beta.connect.connections.get(connectionId, {
			namespace: this.namespace,
		})
	}
}

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

