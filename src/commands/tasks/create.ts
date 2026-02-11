import chalk from "chalk"
import { outputDetail, outputJson } from "../../utils/output"
import { ConnectSession } from "../connect/api"

export async function createTask(
	connection: string,
	tool: string,
	args: string | undefined,
	options: {
		ttl?: string
		namespace?: string
		json?: boolean
	},
) {
	const isJson = options.json ?? false

	let parsedArgs: Record<string, unknown> = {}
	if (args) {
		try {
			parsedArgs = JSON.parse(args)
		} catch (e) {
			const msg = `Invalid JSON args: ${e instanceof Error ? e.message : String(e)}`
			if (isJson) {
				outputJson({ error: msg })
			} else {
				console.error(chalk.red(msg))
			}
			process.exit(1)
		}
	}

	const ttl = options.ttl ? Number.parseInt(options.ttl, 10) : undefined

	try {
		const session = await ConnectSession.create(options.namespace)
		const task = await session.createTask(connection, tool, parsedArgs, {
			ttl,
		})

		if (isJson) {
			outputJson(task)
		} else {
			outputDetail({
				data: {
					taskId: task.taskId,
					status: task.status,
					createdAt: task.createdAt,
					...(task.pollInterval && { pollInterval: `${task.pollInterval}ms` }),
					...(task.ttl && { ttl: `${task.ttl}ms` }),
				},
				json: false,
				tip: `Use smithery tasks get ${connection} ${task.taskId} --wait to poll for the result.`,
			})
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		if (isJson) {
			outputJson({ error: msg })
		} else {
			console.error(chalk.red(`Failed to create task: ${msg}`))
		}
		process.exit(1)
	}
}
