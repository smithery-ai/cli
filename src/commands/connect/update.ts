import chalk from "chalk"
import { ConnectSession } from "./api"
import { outputJson } from "./output"

export async function updateServer(
	connectionId: string,
	options: {
		name?: string
		metadata?: string
		namespace?: string
	},
): Promise<void> {
	// Validate at least one update field is provided
	if (!options.name && !options.metadata) {
		console.error(
			chalk.red(
				"At least one of --name or --metadata must be provided for update",
			),
		)
		process.exit(1)
	}

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

		const connection = await session.updateConnection(connectionId, {
			name: options.name,
			metadata: parsedMetadata,
		})

		const output: Record<string, unknown> = {
			connectionId: connection.connectionId,
			name: connection.name,
			status: connection.status?.state ?? "unknown",
			updated: true,
		}

		// Include metadata in output if present
		if (connection.metadata && Object.keys(connection.metadata).length > 0) {
			output.metadata = connection.metadata
		}

		outputJson(output)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)

		// Handle not found
		if (
			errorMessage.includes("404") ||
			errorMessage.toLowerCase().includes("not found")
		) {
			console.error(chalk.red(`Connection "${connectionId}" not found`))
		} else {
			console.error(chalk.red(`Failed to update server: ${errorMessage}`))
		}
		process.exit(1)
	}
}
