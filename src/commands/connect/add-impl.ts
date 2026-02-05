import chalk from "chalk"
import { ConnectSession } from "./api"
import { formatConnectionOutput } from "./format-connection"
import { outputJson } from "./output"
import { parseJsonObject } from "./parse-json"

export async function addServer(
	mcpUrl: string,
	options: {
		name?: string
		metadata?: string
		headers?: string
		namespace?: string
	},
): Promise<void> {
	try {
		const parsedMetadata = parseJsonObject(options.metadata, "Metadata")
		const parsedHeaders = parseJsonObject<Record<string, string>>(
			options.headers,
			"Headers",
			true,
		)

		const session = await ConnectSession.create(options.namespace)
		const connection = await session.createConnection(mcpUrl, {
			name: options.name,
			metadata: parsedMetadata,
			headers: parsedHeaders,
		})

		const output = formatConnectionOutput(connection)
		outputJson(output)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(chalk.red(`Failed to add connection: ${errorMessage}`))
		process.exit(1)
	}
}
