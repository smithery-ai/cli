import type { ServerDetailResponse } from "@smithery/registry/models/components"
import { logWithTimestamp } from "../commands/run/runner-utils.js"
import {
	ensureBundleInstalled,
	getBundleCommand,
	resolveEnvTemplates,
	resolveTemplateString,
} from "../lib/bundle-manager.js"
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
): Promise<PreparedStdioConnection> {
	const bundleConnection = connection as typeof connection & {
		bundleUrl?: string
		command?: string
		args?: string[]
		env?: Record<string, string>
	}

	// Command-based servers: use command/args directly from connection
	if (bundleConnection.command && bundleConnection.args) {
		return {
			command: bundleConnection.command,
			args: bundleConnection.args,
			env: bundleConnection.env || {},
			qualifiedName: serverDetails.qualifiedName,
		}
	}

	// Bundle-based servers: download bundle and resolve templates
	if (bundleConnection.bundleUrl) {
		logWithTimestamp("[Runner] Bundle connection detected, downloading...")
		const bundleDir = await ensureBundleInstalled(
			serverDetails.qualifiedName,
			bundleConnection.bundleUrl,
		)
		const { command, args, env } = getBundleCommand(bundleDir)

		// Config is already resolved from keychain before calling this function
		// Resolve templates in args (both ${__dirname} and ${user_config.*})
		const resolvedArgs = args.map((arg) =>
			resolveTemplateString(arg, config, bundleDir),
		)

		// Resolve environment variable templates
		const resolvedEnv = env ? resolveEnvTemplates(env, config, bundleDir) : {}

		return {
			command,
			args: resolvedArgs,
			env: resolvedEnv,
			qualifiedName: serverDetails.qualifiedName,
		}
	}

	// Fallback: should not reach here if connection is properly formed
	throw new Error(
		"Invalid connection configuration: missing command/args or bundleUrl",
	)
}
