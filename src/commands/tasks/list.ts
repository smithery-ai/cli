import chalk from "chalk"
import { outputJson, outputTable } from "../../utils/output"
import { ConnectSession } from "../connect/api"
import { formatTaskOutput } from "./format"

export async function listTasks(
	connection: string,
	options: {
		cursor?: string
		namespace?: string
		json?: boolean
	},
) {
	const isJson = options.json ?? false

	try {
		const session = await ConnectSession.create(options.namespace)
		const result = await session.listTasks(connection, options.cursor)

		if (isJson) {
			outputJson(result)
			return
		}

		if (result.tasks.length === 0) {
			console.log(chalk.dim("No tasks found."))
			return
		}

		outputTable({
			data: result.tasks.map(formatTaskOutput),
			columns: ["taskId", "status", "createdAt", "lastUpdatedAt"],
			json: false,
		})

		if (result.nextCursor) {
			console.log(
				chalk.dim(
					`\nMore results available. Use --cursor ${result.nextCursor}`,
				),
			)
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		if (isJson) {
			outputJson({ error: msg })
		} else {
			console.error(chalk.red(`Failed to list tasks: ${msg}`))
		}
		process.exit(1)
	}
}
