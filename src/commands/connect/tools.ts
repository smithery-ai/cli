import type { Connection } from "./api"
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
 * Check if a connection has an issue that would prevent listing tools.
 * Returns an error object if there's an issue, null otherwise.
 */
function getConnectionIssue(
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

	// If server specified, fetch only that server's tools (skip listing all)
	if (server) {
		try {
			const connection = await session.getConnection(server)

			// Check for connection issues before trying to list tools
			const issue = getConnectionIssue(connection)
			if (issue) {
				outputJson({
					tools: [],
					error: issue.error,
					status: issue.status,
					help: "smithery connect get <id> - Get connection details",
				})
				return
			}

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
		} catch {
			outputJson({
				tools: [],
				error: `Server "${server}" not found`,
				help: "smithery connect list - List all servers",
			})
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

	// Check for any connection issues and collect them
	const issues: Array<{ server: string; error: string; status: Record<string, unknown> }> = []
	const healthyConnections: Connection[] = []

	for (const conn of connections) {
		const issue = getConnectionIssue(conn)
		if (issue) {
			issues.push({ server: conn.name, ...issue })
		} else {
			healthyConnections.push(conn)
		}
	}

	const allTools = await Promise.all(
		healthyConnections.map((conn) => session.listToolsForConnection(conn)),
	)

	const flatTools = allTools.flat()

	if (flatTools.length === 0 && issues.length === 0) {
		outputJson({
			tools: [],
			help: "No tools found. Your servers may not have any tools, or may be disconnected.",
		})
		return
	}

	const output: Record<string, unknown> = {
		tools: flatTools.map((t) => ({
			id: `${t.connectionId}/${t.name}`,
			name: t.name,
			server: t.connectionName,
			description: t.description,
			inputSchema: t.inputSchema,
		})),
		help: "smithery connect call <id> '<args>'",
	}

	// Include issues if any connections had problems
	if (issues.length > 0) {
		output.connectionIssues = issues
	}

	outputJson(output)
}
