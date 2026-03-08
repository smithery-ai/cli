import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import {
	type CreateConnectionOptions,
	createConnection as createSmitheryConnection,
} from "@smithery/api/mcp"
import { createSmitheryClient } from "../../lib/smithery-client"
import { normalizeMcpUrl } from "../mcp/normalize-url"

/**
 * Context passed to automation run functions.
 * Provides a `callTool` method that routes calls to the correct MCP connection by server URL.
 */
export interface AutomationContext {
	callTool: (
		server: string,
		toolName: string,
		toolArgs: Record<string, unknown>,
	) => Promise<unknown>
}

/**
 * Options for creating an automation context.
 */
export interface CreateAutomationContextOptions {
	/** MCP server URLs to connect to. */
	servers: string[]
	/** Smithery API key. Falls back to SMITHERY_API_KEY env var or stored key. */
	apiKey?: string
	/** Smithery namespace. Falls back to stored namespace. */
	namespace?: string
}

interface ResolvedConnection {
	connectionId: string
	client: Client
}

/**
 * Create an automation context for programmatic use.
 *
 * Resolves MCP server URLs to Smithery connections (creating them if needed),
 * establishes MCP clients, and returns a `callTool` function.
 *
 * Throws if a connection requires authorization (check error.authorizationUrl).
 *
 * @example
 * ```typescript
 * import { createAutomationContext } from "@smithery/cli/automation"
 *
 * const ctx = await createAutomationContext({
 *   servers: ["https://server.smithery.ai/linear"],
 *   apiKey: process.env.SMITHERY_API_KEY,
 * })
 *
 * const result = await ctx.callTool(
 *   "https://server.smithery.ai/linear",
 *   "create_issue",
 *   { title: "My ticket" },
 * )
 * ```
 */
export async function createAutomationContext(
	options: CreateAutomationContextOptions,
): Promise<AutomationContext> {
	const smitheryClient = await createSmitheryClient(options.apiKey)

	// Resolve namespace
	let namespace = options.namespace
	if (!namespace) {
		const { getNamespace } = await import("../../utils/smithery-settings")
		namespace = await getNamespace()
		if (!namespace) {
			const { namespaces } = await smitheryClient.namespaces.list()
			if (namespaces.length === 0) {
				const created = await smitheryClient.namespaces.create()
				namespace = created.name
			} else {
				namespace = namespaces[0].name
			}
		}
	}

	// Resolve connections for each server URL
	const urlToConnection = new Map<string, ResolvedConnection>()

	for (const url of options.servers) {
		const normalizedUrl = normalizeMcpUrl(url)

		// Check for existing connection
		const { connections } = await smitheryClient.connections.list(namespace, {
			mcpUrl: normalizedUrl,
		})

		let connectionId: string

		if (connections.length > 0) {
			const conn = connections[0]
			if (conn.status?.state === "auth_required") {
				const authUrl = (conn.status as { authorizationUrl?: string })
					?.authorizationUrl
				const err = new Error(
					`Connection for ${url} requires authorization`,
				) as Error & { authorizationUrl?: string }
				err.authorizationUrl = authUrl
				throw err
			}
			connectionId = conn.connectionId
		} else {
			// Auto-create
			const conn = await smitheryClient.connections.create(namespace, {
				mcpUrl: normalizedUrl,
			})

			if (conn.status?.state === "auth_required") {
				const authUrl = (conn.status as { authorizationUrl?: string })
					?.authorizationUrl
				const err = new Error(
					`Connection for ${url} requires authorization`,
				) as Error & { authorizationUrl?: string }
				err.authorizationUrl = authUrl
				throw err
			}
			connectionId = conn.connectionId
		}

		// Create MCP client
		const { transport } = await createSmitheryConnection({
			client: smitheryClient as unknown as CreateConnectionOptions["client"],
			namespace,
			connectionId,
		})

		const mcpClient = new Client({
			name: "smithery-automation",
			version: "1.0.0",
		})
		await mcpClient.connect(transport)

		urlToConnection.set(url, { connectionId, client: mcpClient })
	}

	return {
		callTool: async (
			server: string,
			toolName: string,
			toolArgs: Record<string, unknown>,
		): Promise<unknown> => {
			const resolved = urlToConnection.get(server)
			if (!resolved) {
				throw new Error(
					`Server "${server}" was not included in the servers array.`,
				)
			}
			return resolved.client.callTool({
				name: toolName,
				arguments: toolArgs,
			})
		},
	}
}
