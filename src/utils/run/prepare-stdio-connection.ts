import type { ServerDetailResponse } from "@smithery/registry/models/components"
import { logWithTimestamp } from "../../commands/run/utils.js"
import {
	ensureBundleInstalled,
	getHydratedBundleCommand,
} from "../../lib/mcpb.js"
import type { ServerConfig, StdioConnection } from "../../types/registry.js"

export interface PreparedStdioConnection {
	command: string
	args: string[]
	env: Record<string, string>
	qualifiedName: string
}

/**
 * Type guard to check if a value is a valid StdioConnection.
 * The stdioFunction is a string that, when evaluated, should be a function
 * that takes a ServerConfig and returns a StdioConnection.
 */
function isValidStdioConnection(result: unknown): result is StdioConnection {
	return (
		result !== null &&
		typeof result === "object" &&
		"command" in result &&
		typeof result.command === "string"
	)
}

type ConnectionType = "command" | "stdioFunction" | "bundle"

function determineConnectionType(connection: {
	command?: string
	args?: string[]
	stdioFunction?: string
	bundleUrl?: string
}): ConnectionType {
	if (connection.command && connection.args) {
		return "command"
	}
	if (connection.stdioFunction) {
		return "stdioFunction"
	}
	if (connection.bundleUrl) {
		return "bundle"
	}
	throw new Error(
		"Invalid connection configuration: missing command/args, stdio function, or bundleUrl",
	)
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
		stdioFunction?: string
	}

	const connectionType = determineConnectionType(bundleConnection)

	switch (connectionType) {
		case "command": {
			return {
				command: bundleConnection.command!,
				args: bundleConnection.args!,
				env: bundleConnection.env || {},
				qualifiedName: serverDetails.qualifiedName,
			}
		}

		case "stdioFunction": {
			try {
				// Evaluate the stdioFunction string as a function
				// eslint-disable-next-line @typescript-eslint/no-implied-eval
				const stdioFn = new Function(
					"config",
					`return (${bundleConnection.stdioFunction})(config)`,
				)
				const result = stdioFn(config) as unknown

				if (isValidStdioConnection(result)) {
					return {
						command: result.command,
						args: Array.isArray(result.args) ? result.args : [],
						env: (result.env && typeof result.env === "object"
							? result.env
							: {}) as Record<string, string>,
						qualifiedName: serverDetails.qualifiedName,
					}
				}

				throw new Error(
					"stdioFunction did not return a valid object with command property",
				)
			} catch (error) {
				throw new Error(
					`Failed to evaluate stdioFunction: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		case "bundle": {
			logWithTimestamp("[Runner] Bundle connection detected, downloading...")
			const bundleDir = await ensureBundleInstalled(
				serverDetails.qualifiedName,
				bundleConnection.bundleUrl!,
			)
			// Config is already resolved from keychain before calling this function
			const hydrated = getHydratedBundleCommand(bundleDir, config)

			return {
				command: hydrated.command,
				args: hydrated.args,
				env: hydrated.env,
				qualifiedName: serverDetails.qualifiedName,
			}
		}
	}
}
