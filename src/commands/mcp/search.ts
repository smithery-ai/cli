import FlexSearch from "flexsearch"
import pc from "picocolors"
import { isJsonMode, outputJson, outputTable } from "../../utils/output"
import { type Connection, ConnectSession, type ToolInfo } from "./api"
import {
	formatGroupRow,
	formatListToolRow,
	formatToolRow,
	type GroupEntry,
	TOOL_LIST_COLUMNS,
	TOOL_TABLE_COLUMNS,
} from "./tool-table"

const DEFAULT_LIMIT = 10
const DEFAULT_PAGE = 1
const FIND_MODES = ["fuzzy", "substring", "exact"] as const
type FindMode = (typeof FIND_MODES)[number]

function formatConnectionStatus(
	connection: Connection,
): { error: string; status: Record<string, unknown> } | null {
	if (!connection.status) return null

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

function parsePositiveInt(value: string | undefined, fallback: number): number {
	if (!value) return fallback
	const parsed = Number.parseInt(value, 10)
	if (!Number.isFinite(parsed) || parsed < 1) {
		throw new Error(`Expected a positive integer, got "${value}"`)
	}
	return parsed
}

function resolveFindMode(query: string, mode: string | undefined): FindMode {
	const normalized = (mode ?? (query ? "fuzzy" : "substring")).toLowerCase()
	if (FIND_MODES.includes(normalized as FindMode)) {
		return normalized as FindMode
	}
	throw new Error(
		`Invalid match mode "${mode}". Expected one of: ${FIND_MODES.join(", ")}`,
	)
}

function matchTools(
	allTools: ToolInfo[],
	query: string,
	mode: FindMode,
	limit: number,
	page: number,
	all: boolean,
): ToolInfo[] {
	if (!query) return allTools

	if (mode === "fuzzy") {
		const index = new FlexSearch.Index({
			tokenize: "forward",
			resolution: 9,
		})

		for (let i = 0; i < allTools.length; i++) {
			const tool = allTools[i]
			index.add(i, `${tool.name} ${tool.description || ""}`)
		}

		const maxResults = all ? allTools.length : page * limit
		const matchingIndices = index.search(query, {
			limit: maxResults,
		}) as number[]
		return matchingIndices.map((idx) => allTools[idx])
	}

	const normalizedQuery = query.toLowerCase()
	return allTools.filter((tool) => {
		const toolName = tool.name.toLowerCase()
		if (mode === "exact") {
			return toolName === normalizedQuery
		}
		const description = (tool.description ?? "").toLowerCase()
		return (
			toolName.includes(normalizedQuery) ||
			description.includes(normalizedQuery)
		)
	})
}

function outputFindError(message: string, isJson: boolean): never {
	if (isJson) {
		outputJson({ tools: [], error: message })
	} else {
		console.error(pc.red(message))
	}
	process.exit(1)
}

function groupToolsAtLevel(
	tools: ToolInfo[],
	prefix: string,
): { groups: GroupEntry[]; leafTools: ToolInfo[] } {
	const groupMembers = new Map<string, ToolInfo[]>()
	const leafTools: ToolInfo[] = []

	for (const tool of tools) {
		const relative = prefix ? tool.name.slice(prefix.length) : tool.name
		const dotIndex = relative.indexOf(".")

		if (dotIndex === -1) {
			leafTools.push(tool)
		} else {
			const groupPrefix = prefix + relative.slice(0, dotIndex + 1)
			const members = groupMembers.get(groupPrefix)
			if (members) {
				members.push(tool)
			} else {
				groupMembers.set(groupPrefix, [tool])
			}
		}
	}

	const groups: GroupEntry[] = []
	for (const [groupPrefix, members] of groupMembers) {
		if (members.length === 1) {
			// Single-tool group — show the tool directly instead of a folder
			leafTools.push(members[0])
		} else {
			const first = members.find((m) => m.description)
			groups.push({
				prefix: groupPrefix,
				count: members.length,
				preview: first?.description,
			})
		}
	}

	groups.sort((a, b) => a.prefix.localeCompare(b.prefix))

	return { groups, leafTools }
}

export async function findTools(
	query: string | undefined,
	options: {
		namespace?: string
		connection: string
		limit?: string
		page?: string
		all?: boolean
		flat?: boolean
		match?: string
		prefix?: string
	},
): Promise<void> {
	const isJson = isJsonMode()
	const normalizedQuery = (query ?? "").trim()

	let limit = DEFAULT_LIMIT
	let page = DEFAULT_PAGE
	let mode: FindMode
	try {
		limit = parsePositiveInt(options.limit, DEFAULT_LIMIT)
		page = parsePositiveInt(options.page, DEFAULT_PAGE)
		mode = resolveFindMode(normalizedQuery, options.match)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		outputFindError(message, isJson)
	}

	const session = await ConnectSession.create(options.namespace)

	let connections: Connection[] = []
	try {
		const connection = await session.getConnection(options.connection)
		connections = [connection]
	} catch {
		if (!isJson) {
			console.error(pc.red(`Connection "${options.connection}" not found`))
		}
		outputTable({
			data: [],
			columns: [],
			json: isJson,
			jsonData: {
				tools: [],
				error: `Connection "${options.connection}" not found`,
				hint: "smithery mcp list - List all connections",
			},
			tip: "smithery mcp list - List all connections",
		})
		process.exit(1)
	}

	const allTools: ToolInfo[] = []
	const issues: Array<{
		server: string
		error: string
		status?: Record<string, unknown>
	}> = []

	const results = await Promise.allSettled(
		connections.map((conn) => session.listToolsForConnection(conn)),
	)
	for (let i = 0; i < results.length; i++) {
		const result = results[i]
		const conn = connections[i]
		if (result.status === "fulfilled") {
			allTools.push(...result.value)
			continue
		}
		const issue = formatConnectionStatus(conn)
		if (issue) {
			issues.push({ server: conn.name, ...issue })
		} else {
			const errorMessage =
				result.reason instanceof Error
					? result.reason.message
					: String(result.reason)
			issues.push({ server: conn.name, error: errorMessage })
		}
	}

	if (!isJson && issues.length > 0) {
		for (const issue of issues) {
			const authUrl = issue.status?.authorizationUrl as string | undefined
			console.error(pc.yellow(issue.error))
			if (authUrl) {
				console.error(pc.yellow(`Authorize at: ${authUrl}`))
			}
		}
	}

	if (allTools.length === 0) {
		outputTable({
			data: [],
			columns: [],
			json: isJson,
			jsonData: {
				tools: [],
				...(issues.length > 0 ? { connectionIssues: issues } : {}),
			},
			tip:
				issues.length > 0
					? undefined
					: "No tools found. Your connections may not have any tools, or may be disconnected.",
		})
		return
	}

	const isListMode = "prefix" in options

	if (isListMode) {
		const prefix = options.prefix ?? ""
		const candidates = prefix
			? allTools.filter((tool) =>
					tool.name.toLowerCase().startsWith(prefix.toLowerCase()),
				)
			: allTools

		// --flat: flatten output so `tool list --flat | grep` works naturally
		if (options.flat) {
			const data = candidates.map(formatListToolRow)
			const jsonEntries = candidates.map((t) => ({
				type: "tool" as const,
				name: t.name,
				description: t.description ?? "",
				inputSchema: t.inputSchema,
				...(t.annotations ? { annotations: t.annotations } : {}),
			}))

			outputTable({
				data,
				columns: TOOL_LIST_COLUMNS,
				json: isJson,
				jsonData: {
					connection: options.connection,
					tools: jsonEntries,
					total: candidates.length,
					...(prefix ? { prefix } : {}),
					flat: true,
					page: 1,
					hasMore: false,
					...(issues.length > 0 ? { connectionIssues: issues } : {}),
				},
				pagination: { total: candidates.length },
				tip:
					candidates.length === 0
						? prefix
							? `No tools found with prefix "${prefix}".`
							: "No tools found."
						: `Use smithery tool call ${options.connection} <tool> '<args>' to call a tool.`,
			})
			return
		}

		const { groups, leafTools } = groupToolsAtLevel(candidates, prefix)

		const tableRows = [
			...groups.map(formatGroupRow),
			...leafTools.map(formatListToolRow),
		]
		const jsonEntries = [
			...groups.map((g) => ({
				type: "group" as const,
				name: g.prefix,
				count: g.count,
				...(g.preview ? { preview: g.preview } : {}),
			})),
			...leafTools.map((t) => ({
				type: "tool" as const,
				name: t.name,
				description: t.description ?? "",
				inputSchema: t.inputSchema,
				...(t.annotations ? { annotations: t.annotations } : {}),
			})),
		]

		const total = tableRows.length
		const offset = (page - 1) * limit
		const visibleRows = tableRows.slice(offset, offset + limit)
		const visibleJson = jsonEntries.slice(offset, offset + limit)
		const hasMore = offset + limit < total

		const hasVisibleGroups = visibleJson.some((e) => e.type === "group")

		outputTable({
			data: visibleRows,
			columns: TOOL_LIST_COLUMNS,
			json: isJson,
			jsonData: {
				connection: options.connection,
				tools: visibleJson,
				total,
				...(prefix ? { prefix } : {}),
				page,
				hasMore,
				...(issues.length > 0 ? { connectionIssues: issues } : {}),
			},
			pagination: { page, hasMore, total },
			tip:
				total === 0
					? prefix
						? `No tools found with prefix "${prefix}".`
						: "No tools found."
					: hasVisibleGroups
						? `Use smithery tool list ${options.connection} <prefix> to browse deeper.`
						: `Use smithery tool call ${options.connection} <tool> '<args>' to call a tool.`,
		})
		return
	}

	// Find mode: flat results across connections
	const matches = matchTools(
		allTools,
		normalizedQuery,
		mode,
		limit,
		page,
		Boolean(options.all),
	)

	const offset = (page - 1) * limit
	const visible = options.all ? matches : matches.slice(offset, offset + limit)
	const hasMore = options.all ? false : offset + limit < matches.length
	const data = visible.map(formatToolRow)

	outputTable({
		data,
		columns: TOOL_TABLE_COLUMNS,
		json: isJson,
		jsonData: {
			tools: data,
			total: matches.length,
			mode,
			...(normalizedQuery ? { query: normalizedQuery } : {}),
			...(options.all
				? { all: true, page: 1, hasMore: false }
				: { page, hasMore }),
			...(issues.length > 0 ? { connectionIssues: issues } : {}),
		},
		pagination: options.all
			? { total: matches.length }
			: { page, hasMore, total: matches.length },
		tip:
			data.length === 0
				? "No tools found. Try a broader query or change --match mode."
				: "Use smithery tool call <connection> <tool> '<args>' to call a tool.",
	})
}
