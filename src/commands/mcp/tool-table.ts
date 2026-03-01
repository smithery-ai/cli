import { truncate } from "../../utils/output"
import type { ToolInfo } from "./api"

export function formatToolRow(tool: ToolInfo) {
	return {
		name: tool.name,
		connection: tool.connectionId,
		description: tool.description ?? "",
		inputSchema: tool.inputSchema,
		...(tool.annotations ? { annotations: tool.annotations } : {}),
	}
}

export interface GroupEntry {
	prefix: string
	count: number
}

export function formatGroupRow(group: GroupEntry) {
	return {
		name: group.prefix,
		description: `${group.count} ${group.count === 1 ? "tool" : "tools"}`,
	}
}

export function formatListToolRow(tool: ToolInfo) {
	return {
		name: tool.name,
		description: tool.description ?? "",
		inputSchema: tool.inputSchema,
		...(tool.annotations ? { annotations: tool.annotations } : {}),
	}
}

export const TOOL_TABLE_COLUMNS = [
	{ key: "name", header: "TOOL" },
	{ key: "connection", header: "CONNECTION" },
	{
		key: "description",
		header: "DESCRIPTION",
		format: (v: unknown) => truncate(String(v ?? "")),
	},
]

export const TOOL_LIST_COLUMNS = [
	{ key: "name", header: "TOOL" },
	{
		key: "description",
		header: "DESCRIPTION",
		format: (v: unknown) => truncate(String(v ?? "")),
	},
]
