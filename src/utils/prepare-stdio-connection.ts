import type { ServerDetailResponse } from "@smithery/registry/models/components"
import { fetchConnection } from "../lib/registry.js"
import type { ServerConfig } from "../types/registry.js"
import {
	ensureBundleInstalled,
	getBundleCommand,
} from "../lib/bundle-manager.js"
import { logWithTimestamp } from "../commands/run/runner-utils.js"

export interface PreparedStdioConnection {
	command: string
	args: string[]
	env: Record<string, string>
	qualifiedName: string
}

export async function prepareStdioConnection(
	serverDetails: ServerDetailResponse,
	connection: typeof serverDetails.connections[number],
	config: ServerConfig,
	apiKey: string | undefined,
): Promise<PreparedStdioConnection> {
	const bundleConnection = connection as typeof connection & { bundleUrl?: string, command?: string, args?: string[], env?: Record<string, string> }
	
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
		return {
			command,
			args,
			env: {},
			qualifiedName: serverDetails.qualifiedName,
		}
	}
	
	logWithTimestamp("[Runner] Fetching stdio connection details from registry...")
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
