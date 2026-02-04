import chalk from "chalk"
import { type Connection, ConnectSession } from "./api"
import { outputJson } from "./output"

export async function setServer(
	connectionId: string,
	options: {
		url?: string
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
		if (options.url) {
			// Create new connection with specified ID
			connection = await session.setConnection(connectionId, options.url, {
				name: options.name,
				metadata: parsedMetadata,
			})
		} else {
			// Update existing connection
			if (!options.name && !parsedMetadata) {
				console.error(
					chalk.red(
						"Either --url (to create) or --name/--metadata (to update) must be provided",
					),
				)
				process.exit(1)
			}
			connection = await session.updateConnection(connectionId, {
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

		// Handle 409 conflict for duplicate ID
		if (
			errorMessage.includes("409") ||
			errorMessage.toLowerCase().includes("already exists")
		) {
			console.error(
				chalk.red(
					`Connection "${connectionId}" already exists. Omit --url to update it, or use 'smithery connect remove' to delete it first.`,
				),
			)
		} else if (
			errorMessage.includes("404") ||
			errorMessage.toLowerCase().includes("not found")
		) {
			console.error(
				chalk.red(
					`Connection "${connectionId}" not found. Use --url to create a new connection.`,
				),
			)
		} else {
			console.error(chalk.red(`Failed to set connection: ${errorMessage}`))
		}
		process.exit(1)
	}
}
