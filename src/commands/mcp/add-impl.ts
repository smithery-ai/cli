import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
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
		unstableWebhookUrl?: string
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
					pc.yellow(
						`Connection already exists for this URL: ${match.name} (${match.connectionId}, status: ${status})`,
					),
				)
				if (status === "auth_required") {
					const authUrl = (match.status as { authorizationUrl?: string })
						?.authorizationUrl
					if (authUrl) {
						console.error(
							pc.yellow(`Authorization required. Run: open "${authUrl}"`),
						)
					}
				} else if (status === "connected") {
					console.error(
						pc.yellow(
							`Use "smithery tool list ${match.connectionId}" to interact with it.`,
						),
					)
				}
				console.error(
					pc.dim(`Use --force to create a new connection anyway.`),
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
			unstableWebhookUrl: options.unstableWebhookUrl,
		})

		if (connection.status?.state === "auth_required") {
			const authUrl = (connection.status as { authorizationUrl?: string })
				?.authorizationUrl
			if (authUrl) {
				console.error(
					pc.yellow(`Authorization required. Run: open "${authUrl}"`),
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
		fatal("Failed to add connection", error)
	}
}
