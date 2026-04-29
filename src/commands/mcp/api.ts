import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { ConflictError } from "@smithery/api"
import { SmitheryAuthorizationError } from "@smithery/api/mcp"
import type {
	Connection,
	ConnectionCreateParams,
	ConnectionListParams,
	ConnectionsListResponse,
} from "@smithery/api/resources/connections.js"
import { createSmitheryClient } from "../../lib/smithery-client"
import {
	getNamespace as getStoredNamespace,
	setNamespace,
} from "../../utils/smithery-settings"

export type { Connection, ConnectionsListResponse }
export type ConnectionTransport = NonNullable<Connection["transport"]>

export interface Trigger {
	name: string
	description?: string
	delivery?: string[]
	inputSchema?: Record<string, unknown>
	payloadSchema?: Record<string, unknown>
}

export interface TriggerInstance {
	id: string
	name: string
	connection_id?: string
	params?: Record<string, unknown>
	created_at?: string
}

export interface TriggerSubscription {
	id: string
	url: string
	secret?: string
}

export interface ToolInfo extends Tool {
	connectionId: string
	connectionName: string
}

// Use Awaited to get the concrete type from createSmitheryClient
type SmitheryClient = Awaited<ReturnType<typeof createSmitheryClient>>

type ConnectionWriteOptions = Pick<
	ConnectionCreateParams,
	"name" | "metadata" | "headers" | "transport"
>

type ConnectionsListQuery = ConnectionListParams &
	Record<`metadata.${string}`, string>

const SMITHERY_RUN_BASE_URL = "https://smithery.run"

/**
 * Session for Connect operations that reuses clients within a command.
 * Create one session per command to avoid redundant client creation.
 */
export class ConnectSession {
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

	async listToolsForConnection(connection: Connection): Promise<ToolInfo[]> {
		throwIfAuthRequired(connection)

		const result = await this.smitheryClient.get<{ tools?: Tool[] }>(
			toolCollectionPath(this.namespace, connection.connectionId),
			{
				defaultBaseURL: SMITHERY_RUN_BASE_URL,
			},
		)
		return (result.tools ?? []).map((tool) => ({
			...tool,
			connectionId: connection.connectionId,
			connectionName: connection.name,
		}))
	}

	async callTool(
		connectionId: string,
		toolName: string,
		args: Record<string, unknown>,
	): Promise<unknown> {
		throwIfAuthRequired(await this.getConnection(connectionId))

		return this.smitheryClient.post<unknown>(
			toolItemPath(this.namespace, connectionId, toolName),
			{
				body: args,
				defaultBaseURL: SMITHERY_RUN_BASE_URL,
			},
		)
	}

	async createConnection(
		mcpUrl?: string,
		options: ConnectionWriteOptions = {},
	): Promise<Connection> {
		return this.smitheryClient.connections.create(
			this.namespace,
			buildConnectionBody(mcpUrl, options) as ConnectionCreateParams,
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
			return await this.smitheryClient.connections.set(
				connectionId,
				buildConnectionSetParams(this.namespace, mcpUrl, options),
			)
		} catch (error) {
			if (error instanceof ConflictError && options.transport !== "uplink") {
				await this.deleteConnection(connectionId)
				return this.smitheryClient.connections.set(
					connectionId,
					buildConnectionSetParams(this.namespace, mcpUrl, options),
				)
			}
			throw error
		}
	}

	async deleteConnection(connectionId: string): Promise<void> {
		await this.smitheryClient.connections.delete(connectionId, {
			namespace: this.namespace,
		})
	}

	async getConnection(connectionId: string): Promise<Connection> {
		return this.smitheryClient.connections.get(connectionId, {
			namespace: this.namespace,
		})
	}

	async listTriggers(connectionId: string): Promise<Trigger[]> {
		return this.smitheryClient.connections.triggers.list(connectionId, {
			namespace: this.namespace,
		})
	}

	async getTrigger(
		connectionId: string,
		triggerName: string,
	): Promise<Trigger> {
		return this.smitheryClient.connections.triggers.get(triggerName, {
			namespace: this.namespace,
			connectionId,
		})
	}

	async createTrigger(
		connectionId: string,
		triggerName: string,
		params: Record<string, unknown> = {},
	): Promise<TriggerInstance> {
		return this.smitheryClient.connections.triggers.create(triggerName, {
			namespace: this.namespace,
			connectionId,
			params,
		})
	}

	async getTriggerInstance(
		connectionId: string,
		triggerName: string,
		triggerId: string,
	): Promise<TriggerInstance> {
		return this.smitheryClient.connections.triggers.getInstance(triggerId, {
			namespace: this.namespace,
			connectionId,
			triggerName,
		})
	}

	async deleteTrigger(
		connectionId: string,
		triggerName: string,
		triggerId: string,
	): Promise<void> {
		await this.smitheryClient.connections.triggers.delete(triggerId, {
			namespace: this.namespace,
			connectionId,
			triggerName,
		})
	}

	async listSubscriptions(
		connectionId?: string,
	): Promise<TriggerSubscription[]> {
		if (!connectionId) {
			return this.smitheryClient.subscriptions.list(this.namespace)
		}

		return this.smitheryClient.connections.subscriptions.list(connectionId, {
			namespace: this.namespace,
		})
	}

	async createSubscription(
		url: string,
		connectionId?: string,
	): Promise<TriggerSubscription> {
		if (!connectionId) {
			return this.smitheryClient.subscriptions.create(this.namespace, { url })
		}

		return this.smitheryClient.connections.subscriptions.create(connectionId, {
			namespace: this.namespace,
			url,
		})
	}

	async deleteSubscription(
		subscriptionId: string,
		connectionId?: string,
	): Promise<void> {
		if (!connectionId) {
			await this.smitheryClient.subscriptions.delete(subscriptionId, {
				namespace: this.namespace,
			})
			return
		}

		await this.smitheryClient.connections.subscriptions.delete(subscriptionId, {
			namespace: this.namespace,
			connectionId,
		})
	}

	private requestConnectionsList(query?: ConnectionsListQuery) {
		return this.smitheryClient.connections.list(
			this.namespace,
			query as ConnectionListParams,
		)
	}
}

function buildConnectionBody(
	mcpUrl: string | undefined,
	options: ConnectionWriteOptions,
): Record<string, unknown> {
	const body = {
		...(mcpUrl ? { mcpUrl } : {}),
		...(options.name ? { name: options.name } : {}),
		...(options.metadata ? { metadata: options.metadata } : {}),
		...(options.headers ? { headers: options.headers } : {}),
		...(options.transport ? { transport: options.transport } : {}),
	}
	return body
}

function buildConnectionSetParams(
	namespace: string,
	mcpUrl: string | undefined,
	options: ConnectionWriteOptions,
) {
	return {
		namespace,
		...buildConnectionBody(mcpUrl, options),
	}
}

function namespacePath(namespace: string): string {
	return `/${encodeURIComponent(namespace)}`
}

function connectionPath(namespace: string, connectionId: string): string {
	return `${namespacePath(namespace)}/${encodeURIComponent(connectionId)}`
}

function toolCollectionPath(namespace: string, connectionId: string): string {
	return `${connectionPath(namespace, connectionId)}/.tools`
}

function toolItemPath(
	namespace: string,
	connectionId: string,
	toolName: string,
): string {
	return `${toolCollectionPath(namespace, connectionId)}/${encodeToolName(toolName)}`
}

function encodeToolName(toolName: string): string {
	return toolName
		.split(".")
		.map((segment) => encodeURIComponent(segment))
		.join("/")
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

function throwIfAuthRequired(connection: Connection): void {
	if (connection.status?.state !== "auth_required") {
		return
	}

	const setupUrl =
		connection.status.setupUrl ?? connection.status.authorizationUrl
	if (!setupUrl) {
		return
	}

	throw new SmitheryAuthorizationError(
		`Connection "${connection.connectionId}" requires authorization.`,
		setupUrl,
		connection.connectionId,
	)
}
