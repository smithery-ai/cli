import chalk from "chalk"
import { errorMessage } from "../../lib/cli-error"
import { isJsonMode, outputDetail, outputJson } from "../../utils/output"
import type { ToolInfo } from "./api"
import { ConnectSession } from "./api"

function getToolOutput(tool: ToolInfo): Record<string, unknown> {
	const toolWithExtras = tool as ToolInfo & {
		outputSchema?: unknown
		annotations?: unknown
	}

	return {
		name: tool.name,
		connection: tool.connectionId,
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
	connection: string,
	tool: string,
	options: { namespace?: string; json?: boolean; table?: boolean },
): Promise<void> {
	const isJson = isJsonMode(options)

	try {
		const session = await ConnectSession.create(options.namespace)
		const conn = await session.getConnection(connection)
		const tools = await session.listToolsForConnection(conn)
		const found = tools.find((t) => t.name === tool)

		if (!found) {
			const msg = `Tool "${tool}" was not found in connection "${connection}".`
			if (isJson) {
				outputJson({
					tool: null,
					error: msg,
					hint: `Use smithery tools find --connection ${connection} to browse available tools.`,
				})
			} else {
				console.error(chalk.red(msg))
				console.log(
					chalk.dim(
						`Tip: Use smithery tools find --connection ${connection} to browse available tools.`,
					),
				)
			}
			process.exit(1)
		}

		const data = getToolOutput(found)
		outputDetail({
			data,
			json: isJson,
			tip: `Use smithery tools call ${connection} '${found.name}' '<args>' to call this tool.`,
		})
	} catch (error) {
		const msg = errorMessage(error)
		if (isJson) {
			outputJson({ tool: null, error: `Failed to get tool: ${msg}` })
		} else {
			console.error(chalk.red(`Failed to get tool: ${msg}`))
		}
		process.exit(1)
	}
}
