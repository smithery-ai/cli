import { fatal } from "../../lib/cli-error"
import { isJsonMode, outputDetail } from "../../utils/output"
import { ConnectSession } from "./api"
import { formatConnectionOutput } from "./format-connection"
import { parseJsonObject } from "./parse-json"

export async function updateServer(
	id: string,
	options: {
		name?: string
		metadata?: string
		headers?: string
		namespace?: string
	},
): Promise<void> {
	const isJson = isJsonMode()

	try {
		const parsedMetadata = parseJsonObject(options.metadata, "Metadata")
		const parsedHeaders = parseJsonObject<Record<string, string>>(
			options.headers,
			"Headers",
			true,
		)

		const session = await ConnectSession.create(options.namespace)
		const connection = await session.setConnection(id, undefined, {
			name: options.name,
			metadata: parsedMetadata,
			headers: parsedHeaders,
		})

		const output = formatConnectionOutput(connection)
		outputDetail({
			data: output,
			json: isJson,
			tip: `Use smithery tool list ${connection.connectionId} to view tools.`,
		})
	} catch (error) {
		fatal("Failed to update connection", error)
	}
}
