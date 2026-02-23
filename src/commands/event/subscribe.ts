import pc from "picocolors"
import { z } from "zod"
import { errorMessage } from "../../lib/cli-error"
import { isJsonMode, outputJson } from "../../utils/output"
import { ConnectSession } from "../mcp/api"

const EmptyResultSchema = z.object({}).passthrough()

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

		// Register notification handler for incoming events
		mcpClient.fallbackNotificationHandler = async (notification) => {
			if (notification.method === "ai.smithery/events/event") {
				const params = notification.params as {
					topic: string
					data: unknown
				}
				if (isJson) {
					console.log(
						JSON.stringify({
							topic: params.topic,
							data: params.data,
						}),
					)
				} else {
					console.log(
						`${pc.dim("event")} ${pc.cyan(params.topic)} ${JSON.stringify(params.data)}`,
					)
				}
			}
		}

		// Subscribe to the topic
		await mcpClient.request(
			{
				method: "ai.smithery/events/subscribe",
				params: {
					topic,
					...(parsedArgs ? { arguments: parsedArgs } : {}),
				},
			},
			EmptyResultSchema,
		)

		if (!isJson) {
			console.log(
				pc.green(`Subscribed to ${pc.bold(topic)}. Listening for events...`),
			)
			console.log(pc.dim("Press Ctrl+C to stop."))
			console.log()
		}

		// Keep the process alive until interrupted
		const cleanup = async () => {
			if (!isJson) {
				console.log(
					pc.dim("\nDisconnecting (subscription remains active on server)..."),
				)
			}
			await mcpClient.close()
			process.exit(0)
		}

		process.on("SIGINT", cleanup)
		process.on("SIGTERM", cleanup)

		// Keep alive — the process stays open because the MCP transport keeps the connection open
		await new Promise(() => {})
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
