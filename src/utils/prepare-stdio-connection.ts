import type { ServerDetailResponse } from "@smithery/registry/models/components"
import { logWithTimestamp } from "../commands/run/runner-utils.js"
import {
	ensureBundleInstalled,
	getBundleCommand,
} from "../lib/bundle-manager.js"
import { fetchConnection, getUserConfig } from "../lib/registry.js"
import type { ServerConfig } from "../types/registry.js"

export interface PreparedStdioConnection {
	command: string
	args: string[]
	env: Record<string, string>
	qualifiedName: string
}

export async function prepareStdioConnection(
	serverDetails: ServerDetailResponse,
	connection: (typeof serverDetails.connections)[number],
	config: ServerConfig,
	apiKey: string | undefined,
): Promise<PreparedStdioConnection> {
	const bundleConnection = connection as typeof connection & {
		bundleUrl?: string
		command?: string
		args?: string[]
		env?: Record<string, string>
	}

	if (bundleConnection.command && bundleConnection.args) {
		return {
			command: bundleConnection.command,
			args: bundleConnection.args,
			env: bundleConnection.env || {},
			qualifiedName: serverDetails.qualifiedName,
		}
	}

	if (bundleConnection.bundleUrl) {
		logWithTimestamp("[Runner] Bundle connection detected, downloading...")
		const bundleDir = await ensureBundleInstalled(
			serverDetails.qualifiedName,
			bundleConnection.bundleUrl,
		)
		const { command, args } = getBundleCommand(bundleDir)

		let mergedConfig = { ...config }
		if (apiKey) {
			logWithTimestamp("[Runner] Fetching saved config for bundle...")
			const savedConfig = await getUserConfig(
				serverDetails.qualifiedName,
				apiKey,
			)
			if (savedConfig) {
				mergedConfig = { ...savedConfig, ...config }
				logWithTimestamp("[Runner] Merged saved config with runtime config")
			}
		}

		const env: Record<string, string> = {}
		for (const [key, value] of Object.entries(mergedConfig)) {
			env[key] = String(value)
		}

		return {
			command,
			args,
			env,
			qualifiedName: serverDetails.qualifiedName,
		}
	}

	logWithTimestamp(
		"[Runner] Fetching stdio connection details from registry...",
	)
	const serverConfig = await fetchConnection(
		serverDetails.qualifiedName,
		config,
		apiKey,
	)

	if (!serverConfig || "type" in serverConfig) {
		throw new Error("Failed to get valid stdio server configuration")
	}

	return {
		command: serverConfig.command,
		args: serverConfig.args || [],
		env: serverConfig.env || {},
		qualifiedName: serverDetails.qualifiedName,
	}
}
