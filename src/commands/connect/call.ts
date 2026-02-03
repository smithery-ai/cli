import { ConnectSession } from "./api"
import { formatToolOutput, outputJson } from "./output"

export async function callTool(
	toolId: string,
	args: string | undefined,
	options: { namespace?: string },
): Promise<void> {
	// Parse tool ID (format: "connection/tool-name")
	const slashIndex = toolId.indexOf("/")
	if (slashIndex === -1) {
		outputJson({
			result: null,
			isError: true,
			error: `Invalid tool ID format. Expected "connection/tool-name", got "${toolId}"`,
		})
		process.exit(1)
	}

	const connectionId = toolId.slice(0, slashIndex)
	const toolName = toolId.slice(slashIndex + 1)

	if (!connectionId || !toolName) {
		outputJson({
			result: null,
			isError: true,
			error: `Invalid tool ID format. Expected "connection/tool-name", got "${toolId}"`,
		})
		process.exit(1)
	}

	// Parse args JSON
	let parsedArgs: Record<string, unknown> = {}
	if (args) {
		try {
			parsedArgs = JSON.parse(args)
		} catch (e) {
			outputJson({
				result: null,
				isError: true,
				error: `Invalid JSON args: ${e instanceof Error ? e.message : String(e)}`,
			})
			process.exit(1)
		}
	}

	try {
		const session = await ConnectSession.create(options.namespace)
		const result = await session.callTool(connectionId, toolName, parsedArgs)

		// Format output with three-tier strategy
		const output = formatToolOutput(result, false)
		outputJson(output)
	} catch (e) {
		outputJson({
			result: null,
			isError: true,
			error: e instanceof Error ? e.message : String(e),
		})
		process.exit(1)
	}
}
