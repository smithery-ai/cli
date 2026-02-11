import chalk from "chalk"
import type { Connection, ToolInfo } from "./api"
import { ConnectSession } from "./api"
import { outputTable, outputJson, truncate } from "../../utils/output"

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

function formatToolRow(t: ToolInfo) {
	return {
		id: `${t.connectionId}/${t.name}`,
		name: t.name,
		server: t.connectionName,
		description: t.description ?? "",
		inputSchema: t.inputSchema,
	}
}

const TOOL_COLUMNS = [
	{ key: "id", header: "ID" },
	{ key: "name", header: "TOOL" },
	{ key: "server", header: "SERVER" },
	{
		key: "description",
		header: "DESCRIPTION",
		format: (v: unknown) => truncate(String(v ?? "")),
	},
]

export async function listTools(
	server: string | undefined,
	options: { namespace?: string; limit?: string; page?: string; json?: boolean },
): Promise<void> {
	const isJson = options.json ?? false
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
			if (isJson) {
				outputJson({
					tools: [],
					error: `Server "${server}" not found`,
					hint: "smithery mcp list - List all connections",
				})
			} else {
				console.error(chalk.red(`Server "${server}" not found`))
				console.log(chalk.dim("Tip: smithery mcp list - List all connections"))
			}
			return
		}

		try {
			const tools = await session.listToolsForConnection(connection)
			const paginatedTools = tools.slice(offset, offset + limit)
			const hasMore = offset + limit < tools.length
			const data = paginatedTools.map(formatToolRow)

			outputTable({
				data,
				columns: TOOL_COLUMNS,
				json: isJson,
				jsonData: { tools: data, page, hasMore },
				tip: "Use smithery tools call <connection> <tool> '<args>' to call a tool.",
			})
		} catch (error) {
			const issue = formatConnectionStatus(connection)
			const errMsg = issue?.error ?? (error instanceof Error ? error.message : String(error))
			if (isJson) {
				outputJson({
					tools: [],
					error: errMsg,
					...(issue?.status ? { status: issue.status } : {}),
					hint: "smithery mcp get <id> - Get connection details",
				})
			} else {
				console.error(chalk.red(errMsg))
				console.log(chalk.dim("Tip: smithery mcp get <id> - Get connection details"))
			}
		}
		return
	}

	// List tools from all servers with pagination
	const { connections } = await session.listConnections()

	if (connections.length === 0) {
		outputTable({
			data: [],
			columns: TOOL_COLUMNS,
			json: isJson,
			jsonData: { tools: [] },
			tip: "No servers connected. Use 'smithery mcp add <mcp-url>' to add one.",
		})
		return
	}

	const allTools: ToolInfo[] = []
	const issues: Array<{
		server: string
		error: string
		status?: Record<string, unknown>
	}> = []

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

	const paginatedTools = allTools.slice(offset, offset + limit)
	const hasMore = offset + limit < allTools.length
	const data = paginatedTools.map(formatToolRow)

	outputTable({
		data,
		columns: TOOL_COLUMNS,
		json: isJson,
		jsonData: {
			tools: data,
			page,
			hasMore,
			...(issues.length > 0 ? { connectionIssues: issues } : {}),
		},
		tip: data.length === 0
			? "No tools found. Your servers may not have any tools."
			: "Use smithery tools call <connection> <tool> '<args>' to call a tool.",
	})
}
