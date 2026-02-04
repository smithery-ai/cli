import chalk from "chalk"
import { ConnectSession } from "./api"
import { outputJson } from "./output"

export async function addServer(
	mcpUrl: string,
	options: {
		name?: string
		namespace?: string
		metadata?: string
	},
): Promise<void> {
	try {
		// Parse metadata if provided
		let parsedMetadata: Record<string, unknown> | undefined
		if (options.metadata) {
			try {
				parsedMetadata = JSON.parse(options.metadata)
				if (
					typeof parsedMetadata !== "object" ||
					parsedMetadata === null ||
					Array.isArray(parsedMetadata)
				) {
					throw new Error("Metadata must be a JSON object")
				}
			} catch (e) {
				console.error(
					chalk.red(
						`Invalid metadata JSON: ${e instanceof Error ? e.message : String(e)}`,
					),
				)
				process.exit(1)
			}
		}

		const session = await ConnectSession.create(options.namespace)
		const connection = await session.createConnection(mcpUrl, {
			name: options.name,
			metadata: parsedMetadata,
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
		console.error(
			chalk.red(
				`Failed to add server: ${error instanceof Error ? error.message : String(error)}`,
			),
		)
		process.exit(1)
	}
}
