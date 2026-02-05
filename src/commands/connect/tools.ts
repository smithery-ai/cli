import type { Connection, ToolInfo } from "./api"
import { ConnectSession } from "./api"
import { outputJson } from "./output"

interface ToolsOutput {
	tools: Array<{
		id: string
		name: string
		server: string
		description?: string
		inputSchema?: unknown
	}>
	help: string
	error?: string
	status?: Record<string, unknown>
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
		if ("authorizationUrl" in connection.status && connection.status.authorizationUrl) {
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
	options: { namespace?: string },
): Promise<void> {
	const session = await ConnectSession.create(options.namespace)

	// If server specified, fetch only that server's tools
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
			const output: ToolsOutput = {
				tools: tools.map((t) => ({
					id: `${t.connectionId}/${t.name}`,
					name: t.name,
					server: t.connectionName,
					description: t.description,
					inputSchema: t.inputSchema,
				})),
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
				const errorMessage = error instanceof Error ? error.message : String(error)
				outputJson({
					tools: [],
					error: errorMessage,
					help: "smithery connect get <id> - Get connection details",
				})
			}
		}
		return
	}

	// List tools from all servers
	const { connections } = await session.listConnections()

	if (connections.length === 0) {
		outputJson({
			tools: [],
			help: "No servers connected. Use 'smithery connect add <mcp-url>' to add one.",
		})
		return
	}

	// Try to list tools for all connections, collecting errors
	const allTools: ToolInfo[] = []
	const issues: Array<{ server: string; error: string; status?: Record<string, unknown> }> = []

	await Promise.all(
		connections.map(async (conn) => {
			try {
				const tools = await session.listToolsForConnection(conn)
				allTools.push(...tools)
			} catch (error) {
				const issue = formatConnectionStatus(conn)
				if (issue) {
					issues.push({ server: conn.name, ...issue })
				} else {
					const errorMessage = error instanceof Error ? error.message : String(error)
					issues.push({ server: conn.name, error: errorMessage })
				}
			}
		}),
	)

	if (allTools.length === 0 && issues.length === 0) {
		outputJson({
			tools: [],
			help: "No tools found. Your servers may not have any tools.",
		})
		return
	}

	const output: Record<string, unknown> = {
		tools: allTools.map((t) => ({
			id: `${t.connectionId}/${t.name}`,
			name: t.name,
			server: t.connectionName,
			description: t.description,
			inputSchema: t.inputSchema,
		})),
		help: "smithery connect call <id> '<args>'",
	}

	if (issues.length > 0) {
		output.connectionIssues = issues
	}

	outputJson(output)
}
