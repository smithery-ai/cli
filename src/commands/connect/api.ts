import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import {
	type CreateConnectionOptions,
	createConnection as createSmitheryConnection,
} from "@smithery/api/mcp"
import type {
	Connection,
	ConnectionsListResponse,
} from "@smithery/api/resources/experimental/connect/connections.js"
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
			const data =
				await this.smitheryClient.experimental.connect.connections.list(
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

		// Use createConnection from @smithery/api/mcp - skips handshake for faster connections
		// Cast client to work around TypeScript CJS/ESM type incompatibility
		const { transport } = await createSmitheryConnection({
			client: this
				.smitheryClient as unknown as CreateConnectionOptions["client"],
			namespace: this.namespace,
			connectionId,
		})

		const mcpClient = new Client({ name: "smithery-cli", version: "1.0.0" })
		await mcpClient.connect(transport)
		this.mcpClients.set(connectionId, mcpClient)
		return mcpClient
	}

	async listToolsForConnection(connection: Connection): Promise<ToolInfo[]> {
		try {
			const mcpClient = await this.getMcpClient(connection.connectionId)
			const result = await mcpClient.listTools()
			return result.tools.map((tool) => ({
				...tool,
				connectionId: connection.connectionId,
				connectionName: connection.name,
			}))
		} catch {
			// Connection may be disconnected, timeout, or not support tools
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
		options: {
			name?: string
			metadata?: Record<string, unknown>
			headers?: Record<string, string>
		} = {},
	): Promise<Connection> {
		return this.smitheryClient.experimental.connect.connections.create(
			this.namespace,
			{
				mcpUrl,
				name: options.name,
				metadata: options.metadata,
				headers: options.headers,
			},
		)
	}

	/**
	 * Create a connection with a specific ID using the set() API.
	 * Returns 409 error if connection already exists.
	 */
	async setConnection(
		connectionId: string,
		mcpUrl: string,
		options: {
			name?: string
			metadata?: Record<string, unknown>
			headers?: Record<string, string>
		} = {},
	): Promise<Connection> {
		return this.smitheryClient.experimental.connect.connections.set(
			connectionId,
			{
				namespace: this.namespace,
				mcpUrl,
				name: options.name,
				metadata: options.metadata,
				headers: options.headers,
			},
		)
	}

	async deleteConnection(connectionId: string): Promise<void> {
		await this.smitheryClient.experimental.connect.connections.delete(
			connectionId,
			{
				namespace: this.namespace,
			},
		)
	}

	async getConnection(connectionId: string): Promise<Connection> {
		return this.smitheryClient.experimental.connect.connections.get(
			connectionId,
			{
				namespace: this.namespace,
			},
		)
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
