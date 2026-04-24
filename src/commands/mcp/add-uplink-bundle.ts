import type { ServerGetResponse } from "@smithery/api/resources/servers/servers"
import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
import { saveConfig } from "../../lib/keychain"
import { verbose } from "../../lib/logger"
import { ensureBundleInstalled, getHydratedBundleCommand } from "../../lib/mcpb"
import { serveUplink } from "../../lib/uplink"
import { parseServerConfig } from "../../utils/cli-utils"
import { resolveUserConfig } from "../../utils/install/user-config"
import { createSpinner } from "../../utils/spinner"
import { ConnectSession } from "./api"
import { parseJsonObject } from "./parse-json"

export interface BundleAddTarget {
	qualifiedName: string
	bundleUrl: string
	connection: ServerGetResponse.StdioConnection
	server: ServerGetResponse
}

export interface BundleAddOptions {
	id?: string
	name?: string
	namespace?: string
	metadata?: string
	headers?: string
	config?: string
	force?: boolean
}

export async function addBundleUplinkServer(
	bundle: BundleAddTarget,
	options: BundleAddOptions,
): Promise<void> {
	try {
		if (options.headers !== undefined) {
			throw new Error("--headers is not supported for uplink connections.")
		}

		const configOverride = options.config
			? parseServerConfig(options.config)
			: {}
		const parsedMetadata = parseJsonObject(options.metadata, "Metadata")

		const spinner = createSpinner(`Preparing ${bundle.qualifiedName}...`)
		let userConfig: Record<string, unknown>
		let hydrated: {
			command: string
			args: string[]
			env: Record<string, string>
		}
		try {
			userConfig = await resolveUserConfig(
				bundle.connection,
				bundle.qualifiedName,
				configOverride,
				spinner,
			)

			if (Object.keys(userConfig).length > 0) {
				await saveConfig(bundle.qualifiedName, userConfig)
			}

			const bundleDir = await ensureBundleInstalled(
				bundle.qualifiedName,
				bundle.bundleUrl,
			)
			hydrated = getHydratedBundleCommand(bundleDir, userConfig)
			spinner.success(pc.dim(`Prepared ${bundle.qualifiedName}`))
		} catch (error) {
			spinner.error(`Failed to prepare ${bundle.qualifiedName}`)
			throw error
		}

		verbose(
			`Hydrated bundle command: ${hydrated.command} ${hydrated.args.join(" ")}`,
		)

		const name = options.name ?? options.id ?? bundle.qualifiedName
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
				target: {
					kind: "uplink-stdio",
					command: hydrated.command,
					args: hydrated.args,
					env: hydrated.env,
				},
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
