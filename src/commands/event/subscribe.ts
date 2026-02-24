import pc from "picocolors"
import { errorMessage } from "../../lib/cli-error"
import { EmptyEventResultSchema } from "../../lib/events"
import { isJsonMode, outputJson } from "../../utils/output"
import { ConnectSession } from "../mcp/api"

export async function subscribeEvents(
	connection: string,
	topic: string,
	args: string | undefined,
	options: { namespace?: string },
): Promise<void> {
	const isJson = isJsonMode()

	let parsedArgs: Record<string, unknown> | undefined
	if (args) {
		try {
			parsedArgs = JSON.parse(args)
		} catch (e) {
			if (isJson) {
				outputJson({ error: `Invalid JSON args: ${errorMessage(e)}` })
			} else {
				console.error(pc.red(`Invalid JSON args: ${errorMessage(e)}`))
			}
			process.exit(1)
		}
	}

	try {
		const session = await ConnectSession.create(options.namespace)
		const mcpClient = await session.getEventsClient(connection)

		try {
			await mcpClient.request(
				{
					method: "ai.smithery/events/subscribe",
					params: {
						topic,
						...(parsedArgs ? { arguments: parsedArgs } : {}),
					},
				},
				EmptyEventResultSchema,
			)

			if (isJson) {
				outputJson({ topic, subscribed: true })
			} else {
				console.log(pc.green(`Subscribed to ${pc.bold(topic)}.`))
			}
		} finally {
			await mcpClient.close()
		}
	} catch (error) {
		const msg = errorMessage(error)
		if (isJson) {
			outputJson({ error: `Failed to subscribe: ${msg}` })
		} else {
			console.error(pc.red(`Failed to subscribe: ${msg}`))
		}
		process.exit(1)
	}
}
