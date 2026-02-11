import FlexSearch from "flexsearch"
import { outputTable, truncate } from "../../utils/output"
import { ConnectSession, type ToolInfo } from "./api"

export async function searchTools(
	query: string,
	options: { namespace?: string; json?: boolean },
): Promise<void> {
	const isJson = options.json ?? false
	const session = await ConnectSession.create(options.namespace)
	const { connections } = await session.listConnections()

	if (connections.length === 0) {
		outputTable({
			data: [],
			columns: [],
			json: isJson,
			jsonData: { tools: [] },
			tip: "No connections found. Use smithery mcp add <url> to add one.",
		})
		return
	}

	// Fetch tools from each connection in parallel (ignore failures)
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
		outputTable({
			data: [],
			columns: [],
			json: isJson,
			jsonData: { tools: [] },
			tip: "No tools found. Your connections may not have any tools, or may be disconnected.",
		})
		return
	}

	// Use FlexSearch for fuzzy search
	const index = new FlexSearch.Index({
		tokenize: "forward",
		resolution: 9,
	})

	for (let i = 0; i < allTools.length; i++) {
		const tool = allTools[i]
		const text = `${tool.name} ${tool.description || ""}`
		index.add(i, text)
	}

	const matchingIndices = index.search(query, { limit: 10 }) as number[]

	const data = matchingIndices.map((idx) => {
		const tool = allTools[idx]
		return {
			id: `${tool.connectionId}/${tool.name}`,
			name: tool.name,
			connection: tool.connectionName,
			description: tool.description ?? "",
			inputSchema: tool.inputSchema,
		}
	})

	outputTable({
		data,
		columns: [
			{ key: "id", header: "ID" },
			{ key: "name", header: "TOOL" },
			{ key: "connection", header: "CONNECTION" },
			{
				key: "description",
				header: "DESCRIPTION",
				format: (v: unknown) => truncate(String(v ?? "")),
			},
		],
		json: isJson,
		jsonData: { tools: data },
		tip: "Use smithery tools call <connection> <tool> '<args>' to call a tool.",
	})
}
