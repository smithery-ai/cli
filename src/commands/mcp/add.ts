import { fatal } from "../../lib/cli-error"
import { serveUplink, type UplinkTarget } from "../../lib/uplink"
import { finalizeAddedConnection } from "./add-flow"
import { addServer as addServerImpl } from "./add-impl"
import { ConnectSession } from "./api"
import { normalizeMcpUrl } from "./normalize-url"
import { outputConnectionDetail } from "./output-connection"
import { parseJsonObject } from "./parse-json"
import { classifyAddTarget } from "./uplink-target"

export async function addServer(
	server: string | undefined,
	options: {
		id?: string
		name?: string
		namespace?: string
		metadata?: string
		headers?: string
		config?: string
		force?: boolean
		uplinkCommand?: string[]
		unstableWebhookUrl?: string
	},
): Promise<void> {
	const target = await classifyAddTarget({
		server,
		commandTokens: options.uplinkCommand,
	})

	if (target.kind !== "http") {
		return addUplinkServer(target, options)
	}

	const mcpUrl = target.server

	// If id is set but name is not, default name to id
	const name = options.name ?? options.id

	if (options.id) {
		// Upsert with explicit ID
		try {
			const parsedMetadata = parseJsonObject(options.metadata, "Metadata")
			const parsedHeaders = parseJsonObject<Record<string, string>>(
				options.headers,
				"Headers",
				true,
			)
			const session = await ConnectSession.create(options.namespace)
			const connection = await session.setConnection(
				options.id,
				normalizeMcpUrl(mcpUrl),
				{
					name,
					metadata: parsedMetadata,
					headers: parsedHeaders,
					unstableWebhookUrl: options.unstableWebhookUrl,
				},
			)
			const finalConnection = await finalizeAddedConnection(
				session,
				connection,
				{
					name,
					metadata: parsedMetadata,
					headers: parsedHeaders,
					unstableWebhookUrl: options.unstableWebhookUrl,
				},
			)
			outputConnectionDetail({
				connection: finalConnection,
				tip: `Use smithery tool list ${finalConnection.connectionId} to view tools.`,
			})
		} catch (error) {
			fatal("Failed to add connection", error)
		}
		return
	}
	// Use create for auto-generated ID
	return addServerImpl(mcpUrl, { ...options, name })
}

async function addUplinkServer(
	target: UplinkTarget,
	options: {
		id?: string
		name?: string
		namespace?: string
		metadata?: string
		headers?: string
		config?: string
		force?: boolean
		unstableWebhookUrl?: string
	},
): Promise<void> {
	try {
		if (options.headers !== undefined) {
			throw new Error("--headers is not supported for uplink connections.")
		}

		if (options.config) {
			throw new Error("--config is not supported for uplink connections.")
		}

		if (options.unstableWebhookUrl) {
			throw new Error(
				"--unstableWebhookUrl is not supported for uplink connections.",
			)
		}

		const parsedMetadata = parseJsonObject(options.metadata, "Metadata")
		const name = options.name ?? options.id
		const session = await ConnectSession.create(options.namespace)
		const connection = options.id
			? await session.setConnection(options.id, undefined, {
					name,
					metadata: parsedMetadata,
					transport: "uplink",
				})
			: await session.createConnection(undefined, {
					name,
					metadata: parsedMetadata,
					transport: "uplink",
				})

		const namespace = session.getNamespace()
		console.log(
			`Creating connection ${namespace}/${connection.connectionId} ... ok`,
		)

		let exitCode = 0
		try {
			exitCode = await serveUplink({
				namespace,
				connectionId: connection.connectionId,
				target,
				force: options.force,
			})
		} finally {
			await session.deleteConnection(connection.connectionId).catch(() => {})
		}
		if (exitCode !== 0) {
			process.exit(exitCode)
		}
	} catch (error) {
		fatal("Failed to add connection", error)
	}
}
