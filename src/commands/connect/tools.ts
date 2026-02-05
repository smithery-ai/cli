import type { Connection, ToolInfo } from "./api"
import { ConnectSession } from "./api"
import { outputJson } from "./output"

const DEFAULT_LIMIT = 10

interface PaginationCursor {
	connectionIndex: number
	toolOffset: number
}

function encodeCursor(cursor: PaginationCursor): string {
	return Buffer.from(JSON.stringify(cursor)).toString("base64")
}

function decodeCursor(cursor: string): PaginationCursor | null {
	try {
		const decoded = Buffer.from(cursor, "base64").toString("utf-8")
		return JSON.parse(decoded) as PaginationCursor
	} catch {
		return null
	}
}

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
	options: { namespace?: string; limit?: string; cursor?: string },
): Promise<void> {
	const session = await ConnectSession.create(options.namespace)
	const limit = options.limit
		? Number.parseInt(options.limit, 10)
		: DEFAULT_LIMIT

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
			const offset = options.cursor
				? (decodeCursor(options.cursor)?.toolOffset ?? 0)
				: 0
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
				help: "smithery connect call <id> '<args>'",
			}

			if (hasMore) {
				output.nextCursor = encodeCursor({
					connectionIndex: 0,
					toolOffset: offset + limit,
				})
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

	// Parse cursor to determine starting position
	const startCursor = options.cursor ? decodeCursor(options.cursor) : null
	const startConnectionIndex = startCursor?.connectionIndex ?? 0
	const startToolOffset = startCursor?.toolOffset ?? 0

	const collectedTools: ToolInfo[] = []
	const issues: Array<{
		server: string
		error: string
		status?: Record<string, unknown>
	}> = []
	let nextCursor: PaginationCursor | null = null

	// Process connections sequentially starting from cursor position
	for (let i = startConnectionIndex; i < connections.length; i++) {
		if (collectedTools.length >= limit) {
			break
		}

		const conn = connections[i]
		try {
			const tools = await session.listToolsForConnection(conn)

			// Apply offset only for the first connection when resuming
			const offset = i === startConnectionIndex ? startToolOffset : 0
			const remaining = limit - collectedTools.length

			for (
				let j = offset;
				j < tools.length && collectedTools.length < limit;
				j++
			) {
				collectedTools.push(tools[j])
			}

			// Check if there are more tools in this connection or more connections
			if (collectedTools.length >= limit) {
				const nextToolOffset = offset + remaining

				if (nextToolOffset < tools.length) {
					// More tools in current connection
					nextCursor = { connectionIndex: i, toolOffset: nextToolOffset }
				} else if (i + 1 < connections.length) {
					// Move to next connection
					nextCursor = { connectionIndex: i + 1, toolOffset: 0 }
				}
			}
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

	if (collectedTools.length === 0 && issues.length === 0) {
		outputJson({
			tools: [],
			help: "No tools found. Your servers may not have any tools.",
		})
		return
	}

	const output: Record<string, unknown> = {
		tools: collectedTools.map((t) => ({
			id: `${t.connectionId}/${t.name}`,
			name: t.name,
			server: t.connectionName,
			description: t.description,
			inputSchema: t.inputSchema,
		})),
		help: "smithery connect call <id> '<args>'",
	}

	if (nextCursor) {
		output.nextCursor = encodeCursor(nextCursor)
	}

	if (issues.length > 0) {
		output.connectionIssues = issues
	}

	outputJson(output)
}
