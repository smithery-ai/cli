import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { ConflictError } from "@smithery/api"
import {
	type CreateConnectionOptions,
	createConnection as createSmitheryConnection,
	SmitheryAuthorizationError,
} from "@smithery/api/mcp"
import type {
	Connection,
	ConnectionCreateParams,
	ConnectionListParams,
	ConnectionsListResponse,
} from "@smithery/api/resources/connections.js"
import { listEventTriggers } from "../../lib/events"
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
> & {
	unstableWebhookUrl?: string
}

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

	async listEventTriggers(connectionId: string): Promise<Trigger[]> {
		const mcpClient = await this.getEventsClient(connectionId)
		try {
			const { events } = await listEventTriggers(mcpClient)
			return events
		} finally {
			await mcpClient.close()
		}
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
		const response = await this.smitheryClient.get<{ triggers?: Trigger[] }>(
			triggerCollectionPath(this.namespace, connectionId),
			{
				defaultBaseURL: SMITHERY_RUN_BASE_URL,
			},
		)
		return response?.triggers ?? []
	}

	async getTrigger(
		connectionId: string,
		triggerName: string,
	): Promise<Trigger> {
		return this.smitheryClient.get<Trigger>(
			triggerItemPath(this.namespace, connectionId, triggerName),
			{
				defaultBaseURL: SMITHERY_RUN_BASE_URL,
			},
		)
	}

	async createTrigger(
		connectionId: string,
		triggerName: string,
		params: Record<string, unknown> = {},
	): Promise<TriggerInstance> {
		return this.smitheryClient.post<TriggerInstance>(
			triggerItemPath(this.namespace, connectionId, triggerName),
			{
				body: { params },
				defaultBaseURL: SMITHERY_RUN_BASE_URL,
			},
		)
	}

	async getTriggerInstance(
		connectionId: string,
		triggerName: string,
		triggerId: string,
	): Promise<TriggerInstance> {
		return this.smitheryClient.get<TriggerInstance>(
			triggerInstancePath(this.namespace, connectionId, triggerName, triggerId),
			{
				defaultBaseURL: SMITHERY_RUN_BASE_URL,
			},
		)
	}

	async deleteTrigger(
		connectionId: string,
		triggerName: string,
		triggerId: string,
	): Promise<void> {
		await this.smitheryClient.delete(
			triggerInstancePath(this.namespace, connectionId, triggerName, triggerId),
			{
				defaultBaseURL: SMITHERY_RUN_BASE_URL,
			},
		)
	}

	async listSubscriptions(
		connectionId?: string,
	): Promise<TriggerSubscription[]> {
		const response = await this.smitheryClient.get<{
			subscriptions?: TriggerSubscription[]
		}>(subscriptionCollectionPath(this.namespace, connectionId), {
			defaultBaseURL: SMITHERY_RUN_BASE_URL,
		})
		return response?.subscriptions ?? []
	}

	async createSubscription(
		url: string,
		connectionId?: string,
	): Promise<TriggerSubscription> {
		return this.smitheryClient.post<TriggerSubscription>(
			subscriptionCollectionPath(this.namespace, connectionId),
			{
				body: { url },
				defaultBaseURL: SMITHERY_RUN_BASE_URL,
			},
		)
	}

	async deleteSubscription(
		subscriptionId: string,
		connectionId?: string,
	): Promise<void> {
		await this.smitheryClient.delete(
			subscriptionItemPath(this.namespace, subscriptionId, connectionId),
			{
				defaultBaseURL: SMITHERY_RUN_BASE_URL,
			},
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
		...(options.unstableWebhookUrl && {
			unstableWebhookUrl: options.unstableWebhookUrl,
		}),
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

function triggerCollectionPath(
	namespace: string,
	connectionId: string,
): string {
	return `${namespacePath(namespace)}/${encodeURIComponent(connectionId)}/.triggers`
}

function triggerItemPath(
	namespace: string,
	connectionId: string,
	triggerName: string,
): string {
	return `${triggerCollectionPath(namespace, connectionId)}/${encodeURIComponent(triggerName)}`
}

function triggerInstancePath(
	namespace: string,
	connectionId: string,
	triggerName: string,
	triggerId: string,
): string {
	return `${triggerItemPath(namespace, connectionId, triggerName)}/${encodeURIComponent(triggerId)}`
}

function subscriptionCollectionPath(
	namespace: string,
	connectionId?: string,
): string {
	if (!connectionId) {
		return `${namespacePath(namespace)}/.subscriptions`
	}
	return `${namespacePath(namespace)}/${encodeURIComponent(connectionId)}/.subscriptions`
}

function subscriptionItemPath(
	namespace: string,
	subscriptionId: string,
	connectionId?: string,
): string {
	return `${subscriptionCollectionPath(namespace, connectionId)}/${encodeURIComponent(subscriptionId)}`
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
