import chalk from "chalk"
import { ConnectSession } from "./api"
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

		const output: Record<string, unknown> = {
			connectionId: connection.connectionId,
			name: connection.name,
			status: connection.status?.state ?? "unknown",
		}

		// Include metadata in output if present
		if (connection.metadata && Object.keys(connection.metadata).length > 0) {
			output.metadata = connection.metadata
		}

		// Include auth URL if authorization is required
		if (
			connection.status?.state === "auth_required" &&
			"authorizationUrl" in connection.status &&
			connection.status.authorizationUrl
		) {
			output.authorizationUrl = connection.status.authorizationUrl
		}

		outputJson(output)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(chalk.red(`Failed to add connection: ${errorMessage}`))
		process.exit(1)
	}
}
