import chalk from "chalk"
import { outputDetail, outputJson } from "../../utils/output"
import { ConnectSession } from "../connect/api"
import { formatTaskOutput } from "./format"

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"])
const DEFAULT_POLL_INTERVAL = 5000

export async function getTask(
	connection: string,
	taskId: string,
	options: {
		wait?: boolean
		namespace?: string
		json?: boolean
	},
) {
	const isJson = options.json ?? false

	try {
		const session = await ConnectSession.create(options.namespace)

		if (options.wait) {
			await pollUntilDone(session, connection, taskId, isJson)
		} else {
			const result = await session.getTask(connection, taskId)
			if (isJson) {
				outputJson(result)
			} else {
				outputDetail({ data: formatTaskOutput(result), json: false })
			}
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		if (isJson) {
			outputJson({ error: msg })
		} else {
			console.error(chalk.red(`Failed to get task: ${msg}`))
		}
		process.exit(1)
	}
}

async function pollUntilDone(
	session: ConnectSession,
	connection: string,
	taskId: string,
	isJson: boolean,
) {
	let task = await session.getTask(connection, taskId)

	while (!TERMINAL_STATUSES.has(task.status)) {
		const interval = task.pollInterval ?? DEFAULT_POLL_INTERVAL
		if (!isJson) {
			process.stderr.write(
				chalk.dim(
					`  Status: ${task.status}${task.statusMessage ? ` — ${task.statusMessage}` : ""} (polling in ${interval}ms)\n`,
				),
			)
		}
		await sleep(interval)
		task = await session.getTask(connection, taskId)
	}

	if (task.status === "completed") {
		const result = await session.getTaskResult(connection, taskId)
		if (isJson) {
			outputJson(result)
		} else {
			outputJson(result)
		}
	} else {
		if (isJson) {
			outputJson(task)
		} else {
			outputDetail({ data: formatTaskOutput(task), json: false })
		}
	}
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
