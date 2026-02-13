import { fatal } from "../../lib/cli-error"
import { isJsonMode, outputDetail } from "../../utils/output"
import { ConnectSession } from "./api"
import { formatConnectionOutput } from "./format-connection"
import { normalizeMcpUrl } from "./normalize-url"
import { parseJsonObject } from "./parse-json"

export async function setServer(
	id: string,
	mcpUrl: string | undefined,
	options: {
		name?: string
		metadata?: string
		headers?: string
		namespace?: string
		json?: boolean
		table?: boolean
	},
): Promise<void> {
	const isJson = isJsonMode(options)

	try {
		const parsedMetadata = parseJsonObject(options.metadata, "Metadata")
		const parsedHeaders = parseJsonObject<Record<string, string>>(
			options.headers,
			"Headers",
			true,
		)

		const session = await ConnectSession.create(options.namespace)

		// If no URL provided, fetch from existing connection
		let resolvedUrl: string
		if (mcpUrl) {
			resolvedUrl = normalizeMcpUrl(mcpUrl)
		} else {
			const existing = await session.getConnection(id)
			resolvedUrl = existing.mcpUrl
		}

		const connection = await session.setConnection(id, resolvedUrl, {
			name: options.name,
			metadata: parsedMetadata,
			headers: parsedHeaders,
		})

		const output = formatConnectionOutput(connection)
		outputDetail({
			data: output,
			json: isJson,
			tip: `Use smithery tools find --connection ${connection.connectionId} --all to view tools.`,
		})
	} catch (error) {
		fatal("Failed to set connection", error)
	}
}
