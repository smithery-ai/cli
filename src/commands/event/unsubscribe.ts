import pc from "picocolors"
import { z } from "zod"
import { errorMessage } from "../../lib/cli-error"
import { isJsonMode, outputJson } from "../../utils/output"
import { ConnectSession } from "../mcp/api"

const EmptyResultSchema = z.object({}).passthrough()

export async function unsubscribeEvents(
	connection: string,
	topic: string,
	options: { namespace?: string },
): Promise<void> {
	const isJson = isJsonMode()

	try {
		const session = await ConnectSession.create(options.namespace)
		const mcpClient = await session.getEventsClient(connection)

		try {
			await mcpClient.request(
				{
					method: "ai.smithery/events/unsubscribe",
					params: { topic },
				},
				EmptyResultSchema,
			)

			if (isJson) {
				outputJson({ topic, unsubscribed: true })
			} else {
				console.log(pc.green(`Unsubscribed from ${pc.bold(topic)}.`))
			}
		} finally {
			await mcpClient.close()
		}
	} catch (error) {
		const msg = errorMessage(error)
		if (isJson) {
			outputJson({ error: `Failed to unsubscribe: ${msg}` })
		} else {
			console.error(pc.red(`Failed to unsubscribe: ${msg}`))
		}
		process.exit(1)
	}
}
