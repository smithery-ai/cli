import chalk from "chalk"
import { outputDetail } from "../../utils/output"
import { ConnectSession } from "./api"
import { formatConnectionOutput } from "./format-connection"
import { normalizeMcpUrl } from "./normalize-url"
import { parseJsonObject } from "./parse-json"

export async function setServer(
	id: string,
	mcpUrl: string,
	options: {
		name?: string
		metadata?: string
		headers?: string
		namespace?: string
		json?: boolean
	},
): Promise<void> {
	const isJson = options.json ?? false

	try {
		const parsedMetadata = parseJsonObject(options.metadata, "Metadata")
		const parsedHeaders = parseJsonObject<Record<string, string>>(
			options.headers,
			"Headers",
			true,
		)

		const normalizedUrl = normalizeMcpUrl(mcpUrl)
		const session = await ConnectSession.create(options.namespace)
		const connection = await session.setConnection(id, normalizedUrl, {
			name: options.name,
			metadata: parsedMetadata,
			headers: parsedHeaders,
		})

		const output = formatConnectionOutput(connection)
		outputDetail({
			data: output,
			json: isJson,
			tip: `Use smithery tools list ${connection.connectionId} to list tools.`,
		})
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(chalk.red(`Failed to set connection: ${errorMessage}`))
		process.exit(1)
	}
}
