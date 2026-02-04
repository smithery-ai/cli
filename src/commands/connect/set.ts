import chalk from "chalk"
import { type Connection, ConnectSession } from "./api"
import { outputJson } from "./output"

export async function setServer(
	mcpUrl: string,
	options: {
		id?: string
		name?: string
		metadata?: string
		namespace?: string
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

		let connection: Connection
		if (options.id) {
			// Use set() API for custom ID
			connection = await session.setConnection(options.id, mcpUrl, {
				name: options.name,
				metadata: parsedMetadata,
			})
		} else {
			// Use create() API for auto-generated ID
			connection = await session.createConnection(mcpUrl, {
				name: options.name,
				metadata: parsedMetadata,
			})
		}

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

		// Handle 409 conflict for duplicate ID/URL
		if (
			errorMessage.includes("409") ||
			errorMessage.toLowerCase().includes("already exists") ||
			errorMessage.toLowerCase().includes("conflict")
		) {
			if (options.id) {
				console.error(
					chalk.red(
						`Connection "${options.id}" already exists with a different URL. Use 'smithery connect remove' to delete it first.`,
					),
				)
			} else {
				console.error(
					chalk.red(
						`A connection with this URL already exists. Use --id to specify a custom ID.`,
					),
				)
			}
		} else {
			console.error(chalk.red(`Failed to set connection: ${errorMessage}`))
		}
		process.exit(1)
	}
}
