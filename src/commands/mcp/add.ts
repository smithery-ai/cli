import { fatal } from "../../lib/cli-error"
import { verbose } from "../../lib/logger"
import { resolveServer } from "../../lib/registry"
import { serveUplink, type UplinkTarget } from "../../lib/uplink"
import { parseQualifiedName } from "../../utils/cli-utils"
import {
	completeConnectionAuthorization,
	finalizeAddedConnection,
} from "./add-flow"
import { addServer as addServerImpl } from "./add-impl"
import {
	addBundleUplinkServer,
	type BundleAddTarget,
} from "./add-uplink-bundle"
import { ConnectSession, connectionTargetFromInput } from "./api"
import { outputConnectionDetail } from "./output-connection"
import { parseJsonObject } from "./parse-json"
import { loadDynamicMcpModuleSource } from "./source"
import { classifyAddTarget } from "./uplink-target"

interface AddServerOptions {
	id?: string
	name?: string
	namespace?: string
	metadata?: string
	headers?: string
	config?: string
	force?: boolean
	source?: string
	uplinkCommand?: string[]
}

export async function addServer(
	server: string | undefined,
	options: AddServerOptions,
): Promise<void> {
	if (options.source) {
		return addSourceServer(server, options)
	}

	const target = await classifyAddTarget({
		server,
		commandTokens: options.uplinkCommand,
	})

	if (target.kind !== "http") {
		return addUplinkServer(target, options)
	}

	// Qualified names (non-URL inputs) may resolve to a local bundle server;
	// in that case download the bundle and run it behind an uplink. Explicit
	// http(s) URLs skip the registry probe.
	if (server && !isHttpUrl(server)) {
		const bundleTarget = await tryResolveBundleTarget(server)
		if (bundleTarget) {
			return addBundleUplinkServer(bundleTarget, options)
		}
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
				connectionTargetFromInput(mcpUrl),
				{
					name,
					metadata: parsedMetadata,
					headers: parsedHeaders,
				},
			)
			let finalConnection = await finalizeAddedConnection(session, connection, {
				name,
				metadata: parsedMetadata,
				headers: parsedHeaders,
			})
			finalConnection = await completeConnectionAuthorization(
				session,
				finalConnection,
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

async function addSourceServer(
	server: string | undefined,
	options: AddServerOptions,
): Promise<void> {
	try {
		if (!options.source) {
			throw new Error("--source requires a TypeScript source file.")
		}
		if (server) {
			throw new Error("--source cannot be used with a server argument.")
		}
		if (options.uplinkCommand && options.uplinkCommand.length > 0) {
			throw new Error("--source cannot be used with a local command.")
		}
		if (options.headers !== undefined) {
			throw new Error(
				"--headers is not supported for source-backed connections.",
			)
		}
		if (options.config !== undefined) {
			throw new Error(
				"--config is not supported for source-backed connections.",
			)
		}
		if (options.force) {
			throw new Error("--force is not supported for source-backed connections.")
		}

		const parsedMetadata = parseJsonObject(options.metadata, "Metadata")
		const source = await loadDynamicMcpModuleSource(options.source)
		const session = await ConnectSession.create(options.namespace)
		const name = options.name ?? options.id
		const connection = options.id
			? await session.setConnection(
					options.id,
					{ source },
					{
						name,
						metadata: parsedMetadata,
					},
				)
			: await session.createConnection(
					{ source },
					{
						name,
						metadata: parsedMetadata,
					},
				)

		outputConnectionDetail({
			connection,
			tip: `Use smithery tool list ${connection.connectionId} to view tools.`,
		})
	} catch (error) {
		fatal("Failed to add source-backed connection", error)
	}
}

function isHttpUrl(value: string): boolean {
	return value.startsWith("http://") || value.startsWith("https://")
}

async function tryResolveBundleTarget(
	server: string,
): Promise<BundleAddTarget | null> {
	let parsed: ReturnType<typeof parseQualifiedName>
	try {
		parsed = parseQualifiedName(server)
	} catch {
		return null
	}

	try {
		const { server: serverDetails, connection } = await resolveServer(parsed)
		if (connection.type !== "stdio" || !connection.bundleUrl) {
			return null
		}
		return {
			qualifiedName: serverDetails.qualifiedName,
			bundleUrl: connection.bundleUrl,
			connection,
			server: serverDetails,
		}
	} catch (error) {
		verbose(
			`Registry lookup failed for ${server}; falling back to URL-proxy flow: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)
		return null
	}
}

async function addUplinkServer(
	target: UplinkTarget,
	options: AddServerOptions,
): Promise<void> {
	try {
		if (options.headers !== undefined) {
			throw new Error("--headers is not supported for uplink connections.")
		}

		if (options.config) {
			throw new Error("--config is not supported for uplink connections.")
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

		let interrupted = false
		const exitCode = await serveUplink({
			namespace,
			connectionId: connection.connectionId,
			target,
			force: options.force,
			onInterrupt: () => {
				interrupted = true
			},
		})
		if (interrupted) {
			await session.deleteConnection(connection.connectionId).catch(() => {})
		}
		if (exitCode !== 0) {
			process.exit(exitCode)
		}
	} catch (error) {
		fatal("Failed to add connection", error)
	}
}
