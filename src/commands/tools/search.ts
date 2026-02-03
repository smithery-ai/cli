import MiniSearch from "minisearch"
import {
	getPrimaryNamespace,
	listConnections,
	listToolsForConnection,
	type ToolInfo,
} from "./api"
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
	const namespace = options.namespace ?? (await getPrimaryNamespace())

	// List all connections
	const connections = await listConnections(namespace)

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
		connections.map((conn) => listToolsForConnection(namespace, conn)),
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

	// Use MiniSearch for fuzzy search
	const search = new MiniSearch<ToolInfo & { id: number }>({
		fields: ["name", "description"],
		storeFields: [
			"connectionId",
			"connectionName",
			"name",
			"description",
			"inputSchema",
		],
	})

	search.addAll(allTools.map((t, i) => ({ id: i, ...t })))
	const searchResults = search.search(query, {
		boost: { name: 2 },
		fuzzy: 0.2,
		prefix: true,
	})

	const output: SearchOutput = {
		tools: searchResults.slice(0, 10).map((r) => {
			const tool = allTools[r.id]
			return {
				id: `${tool.connectionId}/${tool.name}`,
				name: tool.name,
				connection: tool.connectionName,
				description: tool.description,
				inputSchema: tool.inputSchema,
			}
		}),
		help: "smithery tools call <id> '<args>'",
	}

	outputJson(output)
}
