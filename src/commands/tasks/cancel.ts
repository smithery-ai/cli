import chalk from "chalk"
import { outputDetail, outputJson } from "../../utils/output"
import { ConnectSession } from "../connect/api"
import { formatTaskOutput } from "./format"

export async function cancelTask(
	connection: string,
	taskId: string,
	options: {
		namespace?: string
		json?: boolean
	},
) {
	const isJson = options.json ?? false

	try {
		const session = await ConnectSession.create(options.namespace)
		const result = await session.cancelTask(connection, taskId)

		if (isJson) {
			outputJson(result)
		} else {
			outputDetail({ data: formatTaskOutput(result), json: false })
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		if (isJson) {
			outputJson({ error: msg })
		} else {
			console.error(chalk.red(`Failed to cancel task: ${msg}`))
		}
		process.exit(1)
	}
}
