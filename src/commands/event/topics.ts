import pc from "picocolors"
import { z } from "zod"
import { errorMessage } from "../../lib/cli-error"
import {
	isJsonMode,
	outputJson,
	outputTable,
	truncate,
} from "../../utils/output"
import { ConnectSession } from "../mcp/api"

const TopicsListResultSchema = z.object({
	topics: z.array(
		z.object({
			topic: z.string(),
			name: z.string().optional(),
			description: z.string().optional(),
			inputSchema: z.record(z.string(), z.unknown()).optional(),
			eventSchema: z.record(z.string(), z.unknown()).optional(),
		}),
	),
	nextCursor: z.string().optional(),
})

export async function listTopics(
	connection: string,
	options: { namespace?: string },
): Promise<void> {
	const isJson = isJsonMode()

	try {
		const session = await ConnectSession.create(options.namespace)
		const mcpClient = await session.getEventsClient(connection)

		try {
			const result = await mcpClient.request(
				{
					method: "ai.smithery/events/topics/list",
					params: {},
				},
				TopicsListResultSchema,
			)

			const topics = result.topics
			if (topics.length === 0) {
				if (isJson) {
					outputJson({ topics: [] })
				} else {
					console.log(pc.yellow("No event topics found for this connection."))
				}
				return
			}

			const data = topics.map((t) => ({
				topic: t.topic,
				name: t.name ?? "",
				description: t.description ?? "",
				hasInputSchema: t.inputSchema ? "yes" : "no",
			}))

			outputTable({
				data,
				columns: [
					{ key: "topic", header: "TOPIC" },
					{ key: "name", header: "NAME" },
					{
						key: "description",
						header: "DESCRIPTION",
						format: (v) => truncate(String(v ?? "")),
					},
					{ key: "hasInputSchema", header: "PARAMS" },
				],
				json: isJson,
				jsonData: { topics },
				tip: `Use smithery event subscribe ${connection} <topic> to subscribe to events.`,
			})
		} finally {
			await mcpClient.close()
		}
	} catch (error) {
		const msg = errorMessage(error)
		if (isJson) {
			outputJson({ topics: [], error: `Failed to list topics: ${msg}` })
		} else {
			console.error(pc.red(`Failed to list topics: ${msg}`))
		}
		process.exit(1)
	}
}
