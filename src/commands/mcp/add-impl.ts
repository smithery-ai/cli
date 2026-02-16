import { AuthenticationError } from "@smithery/api"
import chalk from "chalk"
import { errorMessage, fatal } from "../../lib/cli-error"
import { isJsonMode, outputDetail } from "../../utils/output"
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
	},
): Promise<void> {
	const isJson = isJsonMode()

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
							`Use "smithery tool list ${match.connectionId}" to interact with it.`,
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
		const id = connection.connectionId
		outputDetail({
			data: output,
			json: isJson,
			tip: `Call tools: smithery tool call ${id} <tool> '<args>'\nList tools: smithery tool list ${id}`,
		})
	} catch (error) {
		if (error instanceof AuthenticationError) {
			console.error(
				chalk.red("Failed to add connection: Authentication failed."),
			)
			console.error(
				chalk.yellow(
					'\nYour API key may be expired. Run "smithery login" to re-authenticate.',
				),
			)
			process.exit(1)
		}
		const msg = errorMessage(error)
		if (msg.includes("Missing required permission") || msg.includes("403")) {
			console.error(chalk.red(`Failed to add connection: ${msg}`))
			console.error(
				chalk.yellow(
					`\nYour authentication token may be expired or missing required permissions. Run "smithery auth login" to re-authenticate.`,
				),
			)
			process.exit(1)
		}
		fatal("Failed to add connection", error)
	}
}
