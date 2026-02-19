import { fatal } from "../../lib/cli-error"
import { isJsonMode, outputDetail } from "../../utils/output"
import { addServer as addServerImpl } from "./add-impl"
import { ConnectSession } from "./api"
import { formatConnectionOutput } from "./format-connection"
import { normalizeMcpUrl } from "./normalize-url"
import { parseJsonObject } from "./parse-json"

export async function addServer(
	mcpUrl: string,
	options: {
		id?: string
		name?: string
		namespace?: string
		metadata?: string
		headers?: string
		unstableWebhookUrl?: string
	},
): Promise<void> {
	// If id is set but name is not, default name to id
	const name = options.name ?? options.id

	if (options.id) {
		// Upsert with explicit ID
		const isJson = isJsonMode()
		try {
			const parsedMetadata = parseJsonObject(options.metadata, "Metadata")
			const parsedHeaders = parseJsonObject<Record<string, string>>(
				options.headers,
				"Headers",
				true,
			)
			const session = await ConnectSession.create(options.namespace)
			const connection = await session.setConnection(
				options.id,
				normalizeMcpUrl(mcpUrl),
				{
					name,
					metadata: parsedMetadata,
					headers: parsedHeaders,
					unstableWebhookUrl: options.unstableWebhookUrl,
				},
			)
			const output = formatConnectionOutput(connection)
			outputDetail({
				data: output,
				json: isJson,
				tip: `Use smithery tool list ${connection.connectionId} to view tools.`,
			})
		} catch (error) {
			fatal("Failed to add connection", error)
		}
		return
	}
	// Use create for auto-generated ID
	return addServerImpl(mcpUrl, { ...options, name })
}
