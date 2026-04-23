import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { ConflictError } from "@smithery/api"
import {
	type CreateConnectionOptions,
	createConnection as createSmitheryConnection,
} from "@smithery/api/mcp"
import type {
	Connection as SmitheryConnection,
	ConnectionsListResponse as SmitheryConnectionsListResponse,
} from "@smithery/api/resources/connections/connections.js"
import { createSmitheryClient } from "../../lib/smithery-client"
import {
	getNamespace as getStoredNamespace,
	setNamespace,
} from "../../utils/smithery-settings"

export type ConnectionTransport = "http" | "uplink"
export type ConnectionStatus =
	| NonNullable<SmitheryConnection["status"]>
	| { state: "disconnected" }

export interface Connection
	extends Omit<SmitheryConnection, "mcpUrl" | "status"> {
	mcpUrl: string | null
	status?: ConnectionStatus
	transport?: ConnectionTransport
}

export interface ConnectionsListResponse
	extends Omit<SmitheryConnectionsListResponse, "connections"> {
	connections: Connection[]
}

export interface ToolInfo extends Tool {
	connectionId: string
	connectionName: string
}

// Use Awaited to get the concrete type from createSmitheryClient
type SmitheryClient = Awaited<ReturnType<typeof createSmitheryClient>>

type ConnectionWriteOptions = {
	name?: string
	metadata?: Record<string, unknown>
	headers?: Record<string, string>
	unstableWebhookUrl?: string
	transport?: ConnectionTransport
}

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

	getNamespace(): string {
		return this.namespace
	}

	async listConnectionsByUrl(
		mcpUrl: string,
	): Promise<{ connections: Connection[] }> {
		const data = await this.requestConnectionsList({
			mcpUrl,
		})
		return { connections: data.connections }
	}

	async listConnections(options?: {
		limit?: number
		cursor?: string
		metadata?: Record<string, unknown>
	}): Promise<{ connections: Connection[]; nextCursor: string | null }> {
		const metadataQuery = toMetadataQuery(options?.metadata)

		// Explicit cursor: return a single page (manual pagination)
		if (options?.cursor) {
			const data = await this.requestConnectionsList({
				limit: options.limit,
				cursor: options.cursor,
				...metadataQuery,
			})
			return {
				connections: data.connections,
				nextCursor: data.nextCursor,
			}
		}

		// Fetch pages until we have enough results (or all if no limit)
		const all: Connection[] = []
		let cursor: string | undefined

		do {
			const data = await this.requestConnectionsList({
				cursor,
				...metadataQuery,
			})
			all.push(...data.connections)
			cursor = data.nextCursor ?? undefined
		} while (cursor && (!options?.limit || all.length < options.limit))

		if (options?.limit && all.length > options.limit) {
			return {
				connections: all.slice(0, options.limit),
				nextCursor: cursor ?? null,
			}
		}
		return { connections: all, nextCursor: cursor ?? null }
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
		const mcpClient = await this.getMcpClient(connection.connectionId)
		const result = await mcpClient.listTools()
		return result.tools.map((tool) => ({
			...tool,
			connectionId: connection.connectionId,
			connectionName: connection.name,
		}))
	}

	/**
	 * Create an MCP client with events extension capability negotiated.
	 * Unlike getMcpClient, this always creates a fresh client (not cached)
	 * since it uses different capabilities.
	 */
	async getEventsClient(connectionId: string): Promise<Client> {
		const { transport } = await createSmitheryConnection({
			client: this
				.smitheryClient as unknown as CreateConnectionOptions["client"],
			namespace: this.namespace,
			connectionId,
		})

		const mcpClient = new Client(
			{ name: "smithery-cli", version: "1.0.0" },
			{
				capabilities: {
					extensions: { "ai.smithery/events": {} },
				} as Record<string, unknown>,
			},
		)
		await mcpClient.connect(transport)
		return mcpClient
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
		mcpUrl?: string,
		options: ConnectionWriteOptions = {},
	): Promise<Connection> {
		return this.smitheryClient.post<Connection>(
			connectCollectionPath(this.namespace),
			{
				body: buildConnectionBody(mcpUrl, options),
			},
		)
	}

	/**
	 * Create or update a connection with a specific ID.
	 * If the connection already exists (409), deletes and recreates it.
	 */
	async setConnection(
		connectionId: string,
		mcpUrl?: string,
		options: ConnectionWriteOptions = {},
	): Promise<Connection> {
		try {
			return await this.smitheryClient.put<Connection>(
				connectItemPath(this.namespace, connectionId),
				{
					body: buildConnectionBody(mcpUrl, options),
				},
			)
		} catch (error) {
			if (error instanceof ConflictError && options.transport !== "uplink") {
				await this.deleteConnection(connectionId)
				return this.smitheryClient.put<Connection>(
					connectItemPath(this.namespace, connectionId),
					{
						body: buildConnectionBody(mcpUrl, options),
					},
				)
			}
			throw error
		}
	}

	async deleteConnection(connectionId: string): Promise<void> {
		await this.smitheryClient.delete(
			connectItemPath(this.namespace, connectionId),
		)
	}

	async getConnection(connectionId: string): Promise<Connection> {
		return this.smitheryClient.get<Connection>(
			connectItemPath(this.namespace, connectionId),
		)
	}

	async pollEvents(connectionId: string, options?: { limit?: number }) {
		return this.smitheryClient.get<{
			data: Array<{
				id: number
				payload: Record<string, unknown>
				createdAt: string
			}>
			done: boolean
		}>(`/connect/${this.namespace}/${connectionId}/events`, {
			query: options?.limit ? { limit: options.limit } : undefined,
		})
	}

	private requestConnectionsList(query?: Record<string, unknown>) {
		return this.smitheryClient.get<ConnectionsListResponse>(
			connectCollectionPath(this.namespace),
			{ query },
		)
	}
}

function buildConnectionBody(
	mcpUrl: string | undefined,
	options: ConnectionWriteOptions,
): Record<string, unknown> {
	/* DEBUG_BCB */
	const body = {
		...(mcpUrl ? { mcpUrl } : {}),
		...(options.name ? { name: options.name } : {}),
		...(options.metadata ? { metadata: options.metadata } : {}),
		...(options.headers ? { headers: options.headers } : {}),
		...(options.transport ? { transport: options.transport } : {}),
		...(options.unstableWebhookUrl && {
			unstableWebhookUrl: options.unstableWebhookUrl,
		}),
	}
	return body
}

function connectCollectionPath(namespace: string): string {
	return `/connect/${encodeURIComponent(namespace)}`
}

function connectItemPath(namespace: string, connectionId: string): string {
	return `${connectCollectionPath(namespace)}/${encodeURIComponent(connectionId)}`
}

function toMetadataQuery(
	metadata: Record<string, unknown> | undefined,
): Record<string, string> {
	if (!metadata) return {}
	const query: Record<string, string> = {}
	for (const [key, value] of Object.entries(metadata)) {
		query[`metadata.${key}`] =
			typeof value === "string" ? value : JSON.stringify(value)
	}
	return query
}

async function getCurrentNamespace(): Promise<string> {
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
