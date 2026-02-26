import pc from "picocolors"
import { errorMessage, handleMCPAuthError } from "../../lib/cli-error"
import { EmptyEventResultSchema } from "../../lib/events"
import { isJsonMode, outputJson } from "../../utils/output"
import { ConnectSession } from "../mcp/api"

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
				EmptyEventResultSchema,
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
		handleMCPAuthError(error, connection, { json: isJson })
		const msg = errorMessage(error)
		if (isJson) {
			outputJson({ error: `Failed to unsubscribe: ${msg}` })
		} else {
			console.error(pc.red(`Failed to unsubscribe: ${msg}`))
		}
		process.exit(1)
	}
}
