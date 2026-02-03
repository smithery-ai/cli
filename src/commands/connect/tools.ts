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
	const connections = await session.listConnections()

	if (connections.length === 0) {
		outputJson({
			tools: [],
			help: "No servers connected. Use 'smithery connect add <mcp-url>' to add one.",
		})
		return
	}

	// If server specified, only list tools for that server
	if (server) {
		const targetConnection = connections.find(
			(c) =>
				c.connectionId === server ||
				c.name.toLowerCase() === server.toLowerCase(),
		)

		if (!targetConnection) {
			outputJson({
				tools: [],
				error: `Server "${server}" not found`,
				available: connections.map((c) => c.connectionId),
				help: "smithery connect list - List all servers",
			})
			return
		}

		const tools = await session.listToolsForConnection(targetConnection)

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
		return
	}

	// List tools from all servers
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
