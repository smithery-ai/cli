import FlexSearch from "flexsearch"
import { ConnectSession, type ToolInfo } from "./api"
import { outputJson } from "./output"

interface SearchResult {
	id: string
	name: string
	connection: string
	description?: string
	inputSchema?: unknown
}

interface SearchOutput {
	tools: SearchResult[]
	help: string
}

export async function searchTools(
	query: string,
	options: { namespace?: string },
): Promise<void> {
	const session = await ConnectSession.create(options.namespace)
	const connections = await session.listConnections()

	if (connections.length === 0) {
		outputJson({
			tools: [],
			help: "No connections found. Add connections at smithery.ai first.",
		})
		return
	}

	// Fetch tools from each connection in parallel
	const allTools: ToolInfo[] = []
	const results = await Promise.allSettled(
		connections.map((conn) => session.listToolsForConnection(conn)),
	)

	for (const result of results) {
		if (result.status === "fulfilled") {
			allTools.push(...result.value)
		}
	}

	if (allTools.length === 0) {
		outputJson({
			tools: [],
			help: "No tools found. Your connections may not have any tools, or may be disconnected.",
		})
		return
	}

	// Use FlexSearch for fuzzy search
	const index = new FlexSearch.Index({
		tokenize: "forward",
		resolution: 9,
	})

	// Index tools by combining name and description
	for (let i = 0; i < allTools.length; i++) {
		const tool = allTools[i]
		const text = `${tool.name} ${tool.description || ""}`
		index.add(i, text)
	}

	// Search and get matching indices
	const matchingIndices = index.search(query, { limit: 10 }) as number[]

	const output: SearchOutput = {
		tools: matchingIndices.map((idx) => {
			const tool = allTools[idx]
			return {
				id: `${tool.connectionId}/${tool.name}`,
				name: tool.name,
				connection: tool.connectionName,
				description: tool.description,
				inputSchema: tool.inputSchema,
			}
		}),
		help: "smithery connect call <id> '<args>'",
	}

	outputJson(output)
}
