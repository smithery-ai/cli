import type { ServerGetResponse } from "@smithery/api/resources/servers/servers"

type Server = ServerGetResponse
type StdioConnection = ServerGetResponse.StdioConnection

import { logWithTimestamp } from "../../commands/run/utils.js"
import {
	ensureBundleInstalled,
	getHydratedBundleCommand,
} from "../../lib/mcpb.js"
import type { ServerConfig } from "../../types/registry.js"

export interface PreparedStdioConnection {
	command: string
	args: string[]
	env: Record<string, string>
	qualifiedName: string
}

type ConnectionType = "command" | "stdioFunction" | "bundle"

function determineConnectionType(connection: StdioConnection): ConnectionType {
	const conn = connection as StdioConnection & {
		command?: string
		args?: string[]
		stdioFunction?: string
	}
	if (conn.command && conn.args) {
		return "command"
	}
	if (conn.stdioFunction) {
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
	serverDetails: Server,
	connection: StdioConnection,
	config: ServerConfig,
): Promise<PreparedStdioConnection> {
	const bundleConnection = connection as StdioConnection & {
		command?: string
		args?: string[]
		env?: Record<string, string>
		stdioFunction?: string
	}

	const connectionType = determineConnectionType(bundleConnection)

	switch (connectionType) {
		/**
		 * @deprecated Direct command/args connections are deprecated. Use bundle connections instead.
		 */
		case "command": {
			return {
				command: bundleConnection.command!,
				args: bundleConnection.args!,
				env: bundleConnection.env || {},
				qualifiedName: serverDetails.qualifiedName,
			}
		}

		/**
		 * @deprecated stdioFunction connections are no longer supported.
		 *
		 * Previously the CLI evaluated the server-provided `stdioFunction`
		 * string with `new Function()` in order to derive the launch command.
		 * Because the string is fetched from the Smithery registry (i.e. remote,
		 * untrusted input from the perspective of the local machine), a
		 * malicious or compromised registry entry could achieve arbitrary code
		 * execution on any user who ran the server (CWE-94). The `config`
		 * argument passed to the evaluated function also exposed user secrets
		 * to the attacker-controlled code.
		 *
		 * Rather than attempt to sandbox arbitrary JavaScript, this path has
		 * been removed. Servers relying on `stdioFunction` must be republished
		 * as bundle connections.
		 */
		case "stdioFunction": {
			throw new Error(
				`Server "${serverDetails.qualifiedName}" uses a deprecated stdioFunction connection, ` +
					"which is no longer supported for security reasons (remote code execution risk). " +
					"Please ask the server author to republish it as a bundle connection.",
			)
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
