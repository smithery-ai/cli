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
	const connections = await session.listConnections()

	if (connections.length === 0) {
		outputJson({
			tools: [],
			help: "No servers connected. Use 'smithery connect add <mcp-url>' to add one.",
		})
		return
	}
	const allTools = await Promise.all(
		connections.map((conn) => session.listToolsForConnection(conn)),
	)

	const flatTools = allTools.flat()

	if (flatTools.length === 0) {
		outputJson({
			tools: [],
			help: "No tools found. Your servers may not have any tools, or may be disconnected.",
		})
		return
	}

	const output: ToolsOutput = {
		tools: flatTools.map((t) => ({
			id: `${t.connectionId}/${t.name}`,
			name: t.name,
			server: t.connectionName,
			description: t.description,
			inputSchema: t.inputSchema,
		})),
		help: "smithery connect call <id> '<args>'",
	}
	outputJson(output)
}
