import chalk from "chalk"
import { outputDetail } from "../../utils/output"
import { ConnectSession } from "./api"
import { formatConnectionOutput } from "./format-connection"
import { normalizeMcpUrl } from "./normalize-url"
import { parseJsonObject } from "./parse-json"

export async function addServer(
	mcpUrl: string,
	options: {
		name?: string
		metadata?: string
		headers?: string
		namespace?: string
		force?: boolean
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

		// Check for existing connections with the same URL
		if (!options.force) {
			const { connections: existing } =
				await session.listConnectionsByUrl(normalizedUrl)
			if (existing.length > 0) {
				const match = existing[0]
				const status = match.status?.state ?? "unknown"
				console.error(
					chalk.yellow(
						`Connection already exists for this URL: ${match.name} (${match.connectionId}, status: ${status})`,
					),
				)
				if (status === "auth_required") {
					const authUrl = (match.status as { authorizationUrl?: string })
						?.authorizationUrl
					if (authUrl) {
						console.error(
							chalk.yellow(`Authorization required. Run: open "${authUrl}"`),
						)
					}
				} else if (status === "connected") {
					console.error(
						chalk.yellow(
							`Use "smithery tools list ${match.connectionId}" to interact with it.`,
						),
					)
				}
				console.error(
					chalk.dim(`Use --force to create a new connection anyway.`),
				)
				const output = formatConnectionOutput(match)
				outputDetail({ data: output, json: isJson })
				return
			}
		}

		const connection = await session.createConnection(normalizedUrl, {
			name: options.name,
			metadata: parsedMetadata,
			headers: parsedHeaders,
		})

		if (connection.status?.state === "auth_required") {
			const authUrl = (connection.status as { authorizationUrl?: string })
				?.authorizationUrl
			if (authUrl) {
				console.error(
					chalk.yellow(`Authorization required. Run: open "${authUrl}"`),
				)
			}
		}

		const output = formatConnectionOutput(connection)
		outputDetail({
			data: output,
			json: isJson,
			tip: `Use smithery tools list ${connection.connectionId} to list tools.`,
		})
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(chalk.red(`Failed to add connection: ${errorMessage}`))
		if (
			errorMessage.includes("Missing required permission") ||
			errorMessage.includes("403")
		) {
			console.error(
				chalk.yellow(
					`\nYour authentication token may be expired or missing required permissions. Run "smithery auth login" to re-authenticate.`,
				),
			)
		}
		process.exit(1)
	}
}
