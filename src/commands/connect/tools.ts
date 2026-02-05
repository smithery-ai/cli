import type { Connection, ToolInfo } from "./api"
import { ConnectSession } from "./api"
import { outputJson } from "./output"

const DEFAULT_LIMIT = 10

/**
 * Format connection status for error output.
 */
function formatConnectionStatus(
	connection: Connection,
): { error: string; status: Record<string, unknown> } | null {
	if (!connection.status) {
		return null
	}

	if (connection.status.state === "auth_required") {
		const status: Record<string, unknown> = { state: "auth_required" }
		if (
			"authorizationUrl" in connection.status &&
			connection.status.authorizationUrl
		) {
			status.authorizationUrl = connection.status.authorizationUrl
		}
		return {
			error: `Server "${connection.name}" requires authentication`,
			status,
		}
	}

	if (connection.status.state === "error") {
		return {
			error: `Server "${connection.name}" has an error: ${connection.status.message}`,
			status: { state: "error", message: connection.status.message },
		}
	}

	return null
}

export async function listTools(
	server: string | undefined,
	options: { namespace?: string; limit?: string; page?: string },
): Promise<void> {
	const session = await ConnectSession.create(options.namespace)
	const limit = options.limit
		? Number.parseInt(options.limit, 10)
		: DEFAULT_LIMIT
	const page = options.page ? Number.parseInt(options.page, 10) : 1
	const offset = (page - 1) * limit

	// If server specified, fetch only that server's tools (with pagination)
	if (server) {
		let connection: Connection
		try {
			connection = await session.getConnection(server)
		} catch {
			outputJson({
				tools: [],
				error: `Server "${server}" not found`,
				help: "smithery connect list - List all servers",
			})
			return
		}

		try {
			const tools = await session.listToolsForConnection(connection)

			// Apply pagination for single server
			const paginatedTools = tools.slice(offset, offset + limit)
			const hasMore = offset + limit < tools.length

			const output: Record<string, unknown> = {
				tools: paginatedTools.map((t) => ({
					id: `${t.connectionId}/${t.name}`,
					name: t.name,
					server: t.connectionName,
					description: t.description,
					inputSchema: t.inputSchema,
				})),
				page,
				hasMore,
				help: "smithery connect call <id> '<args>'",
			}

			outputJson(output)
		} catch (error) {
			// Listing tools failed - check connection status for known issues
			const issue = formatConnectionStatus(connection)
			if (issue) {
				outputJson({
					tools: [],
					error: issue.error,
					status: issue.status,
					help: "smithery connect get <id> - Get connection details",
				})
			} else {
				// Unknown error (timeout, network issue, etc.)
				const errorMessage =
					error instanceof Error ? error.message : String(error)
				outputJson({
					tools: [],
					error: errorMessage,
					help: "smithery connect get <id> - Get connection details",
				})
			}
		}
		return
	}

	// List tools from all servers with pagination
	const { connections } = await session.listConnections()

	if (connections.length === 0) {
		outputJson({
			tools: [],
			help: "No servers connected. Use 'smithery connect add <mcp-url>' to add one.",
		})
		return
	}

	// Collect all tools from all connections first, then paginate
	const allTools: ToolInfo[] = []
	const issues: Array<{
		server: string
		error: string
		status?: Record<string, unknown>
	}> = []

	// Process connections sequentially to maintain consistent ordering
	for (const conn of connections) {
		try {
			const tools = await session.listToolsForConnection(conn)
			allTools.push(...tools)
		} catch (error) {
			const issue = formatConnectionStatus(conn)
			if (issue) {
				issues.push({ server: conn.name, ...issue })
			} else {
				const errorMessage =
					error instanceof Error ? error.message : String(error)
				issues.push({ server: conn.name, error: errorMessage })
			}
		}
	}

	if (allTools.length === 0 && issues.length === 0) {
		outputJson({
			tools: [],
			help: "No tools found. Your servers may not have any tools.",
		})
		return
	}

	// Apply pagination to collected tools
	const paginatedTools = allTools.slice(offset, offset + limit)
	const hasMore = offset + limit < allTools.length

	const output: Record<string, unknown> = {
		tools: paginatedTools.map((t) => ({
			id: `${t.connectionId}/${t.name}`,
			name: t.name,
			server: t.connectionName,
			description: t.description,
			inputSchema: t.inputSchema,
		})),
		page,
		hasMore,
		help: "smithery connect call <id> '<args>'",
	}

	if (issues.length > 0) {
		output.connectionIssues = issues
	}

	outputJson(output)
}
