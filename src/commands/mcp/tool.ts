import { SmitheryAuthorizationError } from "@smithery/api/mcp"
import pc from "picocolors"
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
	options: { namespace?: string },
): Promise<void> {
	const isJson = isJsonMode()

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
					hint: `Use smithery tool list ${connection} to browse available tools.`,
				})
			} else {
				console.error(pc.red(msg))
				console.log(
					pc.dim(
						`Tip: Use smithery tool list ${connection} to browse available tools.`,
					),
				)
			}
			process.exit(1)
		}

		const data = getToolOutput(found)
		outputDetail({
			data,
			json: isJson,
			tip: `Use smithery tool call ${connection} '${found.name}' '<args>' to call this tool.`,
		})
	} catch (error) {
		if (error instanceof SmitheryAuthorizationError) {
			if (isJson) {
				outputJson({
					tool: null,
					error: `Connection "${connection}" requires authorization.`,
					authorizationUrl: error.authorizationUrl,
				})
			} else {
				console.error(
					pc.yellow(
						`Connection "${connection}" requires authorization. Authorize at:\n${error.authorizationUrl}`,
					),
				)
			}
			process.exit(1)
		}
		const msg = errorMessage(error)
		if (isJson) {
			outputJson({ tool: null, error: `Failed to get tool: ${msg}` })
		} else {
			console.error(pc.red(`Failed to get tool: ${msg}`))
		}
		process.exit(1)
	}
}
