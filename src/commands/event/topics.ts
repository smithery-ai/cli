import pc from "picocolors"
import { errorMessage, handleMCPAuthError } from "../../lib/cli-error"
import { listEventTopics } from "../../lib/events"
import {
	isJsonMode,
	outputJson,
	outputTable,
	truncate,
} from "../../utils/output"
import { ConnectSession } from "../mcp/api"

export async function listTopics(
	connection: string,
	options: { namespace?: string; prefix?: string },
): Promise<void> {
	const isJson = isJsonMode()

	try {
		const session = await ConnectSession.create(options.namespace)
		const mcpClient = await session.getEventsClient(connection)

		try {
			const { eventTopics } = await listEventTopics(mcpClient)

			const topics = options.prefix
				? eventTopics.filter((t) =>
						t.topic.toLowerCase().startsWith(options.prefix!.toLowerCase()),
					)
				: eventTopics

			if (topics.length === 0) {
				if (isJson) {
					outputJson({
						topics: [],
						...(options.prefix ? { prefix: options.prefix } : {}),
					})
				} else {
					const msg = options.prefix
						? `No event topics found matching prefix "${options.prefix}".`
						: "No event topics found for this connection."
					console.log(pc.yellow(msg))
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
				jsonData: {
					topics,
					...(options.prefix ? { prefix: options.prefix } : {}),
				},
				tip: `Use smithery event subscribe ${connection} <topic> to subscribe to events.`,
			})
		} finally {
			await mcpClient.close()
		}
	} catch (error) {
		handleMCPAuthError(error, connection, {
			json: isJson,
			jsonData: { topics: [] },
		})
		const msg = errorMessage(error)
		if (isJson) {
			outputJson({ topics: [], error: `Failed to list topics: ${msg}` })
		} else {
			console.error(pc.red(`Failed to list topics: ${msg}`))
		}
		process.exit(1)
	}
}
