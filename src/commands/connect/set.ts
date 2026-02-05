import chalk from "chalk"
import { type Connection, ConnectSession } from "./api"
import { outputJson } from "./output"

function parseJsonObject<T extends Record<string, unknown>>(
	json: string | undefined,
	name: string,
	validateStringValues = false,
): T | undefined {
	if (!json) return undefined
	try {
		const parsed = JSON.parse(json)
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			throw new Error(`${name} must be a JSON object`)
		}
		if (validateStringValues) {
			for (const [key, value] of Object.entries(parsed)) {
				if (typeof value !== "string") {
					throw new Error(`${name} value for "${key}" must be a string`)
				}
			}
		}
		return parsed as T
	} catch (e) {
		console.error(
			chalk.red(`Invalid ${name.toLowerCase()} JSON: ${e instanceof Error ? e.message : String(e)}`),
		)
		process.exit(1)
	}
}

export async function setServer(
	mcpUrl: string,
	options: {
		id?: string
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

		let connection: Connection
		if (options.id) {
			// Use set() API for custom ID
			connection = await session.setConnection(options.id, mcpUrl, {
				name: options.name,
				metadata: parsedMetadata,
				headers: parsedHeaders,
			})
		} else {
			// Use create() API for auto-generated ID
			connection = await session.createConnection(mcpUrl, {
				name: options.name,
				metadata: parsedMetadata,
				headers: parsedHeaders,
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
