import { errorMessage } from "../../lib/cli-error"
import { outputJson } from "../../utils/output"
import { ConnectSession } from "./api"

export async function callTool(
	connection: string,
	tool: string,
	args: string | undefined,
	options: { namespace?: string },
): Promise<void> {
	let parsedArgs: Record<string, unknown> = {}
	if (args) {
		try {
			parsedArgs = JSON.parse(args)
		} catch (e) {
			outputJson({
				result: null,
				isError: true,
				error: `Invalid JSON args: ${errorMessage(e)}`,
			})
			process.exit(1)
		}
	}

	try {
		const session = await ConnectSession.create(options.namespace)
		const result = await session.callTool(connection, tool, parsedArgs)
		outputJson(result)
	} catch (e) {
		outputJson({
			result: null,
			isError: true,
			error: errorMessage(e),
		})
		process.exit(1)
	}
}
