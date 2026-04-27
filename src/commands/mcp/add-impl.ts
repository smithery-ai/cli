import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
import {
	buildDuplicateInputRequiredTip,
	completeConnectionAuthorization,
	finalizeAddedConnection,
} from "./add-flow"
import { ConnectSession } from "./api"
import { normalizeMcpUrl } from "./normalize-url"
import { outputConnectionDetail } from "./output-connection"
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
				let match = existing[0]
				const status = match.status?.state ?? "unknown"
				console.error(
					pc.yellow(
						`Connection already exists for this URL: ${match.name} (${match.connectionId}, status: ${status})`,
					),
				)
				if (status === "auth_required") {
					match = await completeConnectionAuthorization(session, match)
				} else if (status === "connected") {
					console.error(
						pc.yellow(
							`Use "smithery tool list ${match.connectionId}" to interact with it.`,
						),
					)
				}
				const finalStatus = match.status?.state ?? "unknown"
				const tip =
					buildDuplicateInputRequiredTip(match) ??
					(finalStatus === "connected"
						? `Use smithery tool list ${match.connectionId} to interact with it.`
						: finalStatus === "auth_required"
							? "Use the setup URL above to complete setup."
							: `Use --force to create a new connection anyway.`)
				outputConnectionDetail({
					connection: match,
					tip,
				})
				return
			}
		}

		const connection = await session.createConnection(normalizedUrl, {
			name: options.name,
			metadata: parsedMetadata,
			headers: parsedHeaders,
		})

		let finalConnection = await finalizeAddedConnection(session, connection, {
			name: options.name,
			metadata: parsedMetadata,
			headers: parsedHeaders,
		})
		finalConnection = await completeConnectionAuthorization(
			session,
			finalConnection,
		)

		const id = finalConnection.connectionId
		outputConnectionDetail({
			connection: finalConnection,
			tip: `Call tools: smithery tool call ${id} <tool> '<args>'\nList tools: smithery tool list ${id}`,
		})
	} catch (error) {
		fatal("Failed to add connection", error)
	}
}
