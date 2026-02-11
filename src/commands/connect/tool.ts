import chalk from "chalk"
import { outputDetail, outputJson } from "../../utils/output"
import type { ToolInfo } from "./api"
import { ConnectSession } from "./api"

function parseToolId(
	toolId: string,
): { connectionId: string; toolName: string } | null {
	const slashIndex = toolId.indexOf("/")
	if (slashIndex <= 0 || slashIndex === toolId.length - 1) {
		return null
	}

	return {
		connectionId: toolId.slice(0, slashIndex),
		toolName: toolId.slice(slashIndex + 1),
	}
}

function getToolOutput(tool: ToolInfo): Record<string, unknown> {
	const toolWithExtras = tool as ToolInfo & {
		outputSchema?: unknown
		annotations?: unknown
	}

	return {
		id: `${tool.connectionId}/${tool.name}`,
		name: tool.name,
		connectionId: tool.connectionId,
		connectionName: tool.connectionName,
		description: tool.description ?? "",
		inputSchema: tool.inputSchema,
		...(toolWithExtras.outputSchema
			? { outputSchema: toolWithExtras.outputSchema }
			: {}),
		...(toolWithExtras.annotations
			? { annotations: toolWithExtras.annotations }
			: {}),
	}
}

export async function getTool(
	toolId: string,
	options: { namespace?: string; json?: boolean },
): Promise<void> {
	const isJson = options.json ?? false
	const parsed = parseToolId(toolId)

	if (!parsed) {
		const errorMessage = `Invalid tool ID format. Expected "connection/tool-name", got "${toolId}".`
		if (isJson) {
			outputJson({
				tool: null,
				error: errorMessage,
				hint: "Use smithery tools list <connection> to browse tools.",
			})
		} else {
			console.error(chalk.red(errorMessage))
			console.log(
				chalk.dim("Tip: Use smithery tools list <connection> to browse tools."),
			)
		}
		process.exit(1)
	}

	try {
		const session = await ConnectSession.create(options.namespace)
		const connection = await session.getConnection(parsed.connectionId)
		const tools = await session.listToolsForConnection(connection)
		const tool = tools.find((t) => t.name === parsed.toolName)

		if (!tool) {
			const errorMessage = `Tool "${parsed.toolName}" was not found in connection "${parsed.connectionId}".`
			if (isJson) {
				outputJson({
					tool: null,
					error: errorMessage,
					hint: `Use smithery tools list ${parsed.connectionId} to browse available tools.`,
				})
			} else {
				console.error(chalk.red(errorMessage))
				console.log(
					chalk.dim(
						`Tip: Use smithery tools list ${parsed.connectionId} to browse available tools.`,
					),
				)
			}
			process.exit(1)
		}

		const data = getToolOutput(tool)
		outputDetail({
			data,
			json: isJson,
			tip: `Use smithery tools call ${parsed.connectionId} '${tool.name}' '<args>' to call this tool.`,
		})
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		if (isJson) {
			outputJson({
				tool: null,
				error: `Failed to get tool: ${errorMessage}`,
			})
		} else {
			console.error(chalk.red(`Failed to get tool: ${errorMessage}`))
		}
		process.exit(1)
	}
}
