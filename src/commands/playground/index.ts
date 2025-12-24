import { RequestTimeoutError } from "@smithery/registry/models/errors"
import chalk from "chalk"
import { setupTunnelAndPlayground } from "../../lib/dev-lifecycle"
import { getConfig } from "../../lib/keychain"
import { resolveServer } from "../../lib/registry"
import type { ServerConfig } from "../../types/registry"
import { setupProcessLifecycle } from "../../utils/process-lifecycle"
import { prepareStdioConnection } from "../../utils/run/prepare-stdio-connection"
import { initializeSettings } from "../../utils/smithery-settings.js"
import { logWithTimestamp } from "../run/utils.js"
import { createStdioPlaygroundRunner } from "./stdio-playground-runner"

/**
 * Opens the MCP playground in a browser, supporting three modes:
 *
 * 1. **STDIO mode with server**: `smithery playground <server>` - Resolves server, prepares connection, runs in playground
 * 2. **STDIO mode with raw command**: `smithery playground -- <command>` - Runs raw command in playground
 * 3. **HTTP mode**: `smithery playground --port <port>` - Tunnels existing local HTTP server
 *
 * In all modes, sets up a tunnel to expose the local server and optionally opens
 * the playground in the browser. Handles cleanup on process exit.
 *
 * @param options - Configuration options
 * @param options.server - Qualified server name (triggers STDIO mode with server resolution)
 * @param options.port - Port number (default: 6969 for STDIO, DEFAULT_PORT for HTTP)
 * @param options.command - Command to run as STDIO MCP server (triggers STDIO mode with raw command)
 * @param options.configOverride - Optional configuration override (from --config flag)
 * @param options.apiKey - Smithery API key for authentication
 * @param options.open - Whether to automatically open playground in browser (default: true)
 * @param options.initialMessage - Initial message to send when playground opens
 * @throws {Error} If neither server, command, nor port is provided
 */
export async function playground(options: {
	server?: string
	port?: string
	command?: string
	configOverride?: ServerConfig
	apiKey: string
	open?: boolean
	initialMessage?: string
}): Promise<void> {
	try {
		const settingsResult = await initializeSettings()
		if (!settingsResult.success) {
			logWithTimestamp(
				`[Playground] Settings initialization warning: ${settingsResult.error}`,
			)
		}

		// Mode 1: Server provided - resolve and run in playground
		if (options.server) {
			// Read config from keychain, merge with override if provided
			const keychainConfig = (await getConfig(options.server)) || {}
			const config = {
				...keychainConfig,
				...(options.configOverride || {}),
			}
			logWithTimestamp(
				`[Playground] Loaded config from keychain${Object.keys(options.configOverride || {}).length > 0 ? " (with overrides)" : ""}`,
			)

			const { server, connection } = await resolveServer(options.server)

			logWithTimestamp(
				`[Playground] Connecting to server: ${JSON.stringify({
					id: server.qualifiedName,
					connectionType: connection.type,
				})}`,
			)

			if (connection.type !== "stdio") {
				throw new Error(
					`Server "${options.server}" uses ${connection.type} connection type. Only STDIO servers are supported in playground mode.`,
				)
			}

			const preparedConnection = await prepareStdioConnection(
				server,
				connection,
				config,
			)

			const port = options.port ? Number.parseInt(options.port, 10) : 6969

			await createStdioPlaygroundRunner(
				{
					command: preparedConnection.command,
					args: preparedConnection.args,
					env: preparedConnection.env,
					qualifiedName: preparedConnection.qualifiedName,
				},
				options.apiKey,
				{
					port,
					open: options.open !== false,
					initialMessage: options.initialMessage || "Say hello to the world!",
				},
			)

			// Keep the process alive
			process.stdin.resume()
			await new Promise<void>(() => {})
			return
		}

		// Mode 2: Command provided - use STDIO mode with raw command
		if (options.command) {
			const port = options.port ? Number.parseInt(options.port, 10) : 6969

			await createStdioPlaygroundRunner(
				{ rawCommand: options.command },
				options.apiKey,
				{
					port,
					open: options.open !== false,
					initialMessage: options.initialMessage,
				},
			)

			// Keep the process alive
			process.stdin.resume()
			await new Promise<void>(() => {})
			return
		}

		// Mode 3: Port provided - HTTP mode: tunnel existing server
		if (options.port) {
			const { listener } = await setupTunnelAndPlayground(
				options.port,
				options.apiKey,
				options.open !== false,
			)

			// Handle cleanup on exit
			const cleanup = async () => {
				console.log(chalk.yellow("\nShutting down playground..."))

				// Close tunnel
				try {
					await listener.close()
				} catch (_error) {
					// Tunnel already closed
				}
			}

			// Set up process lifecycle management
			setupProcessLifecycle({
				cleanupFn: cleanup,
				processName: "playground",
			})
			return
		}

		// No valid mode specified
		console.error(chalk.red("× Please provide a server, command, or port."))
		console.error(
			chalk.yellow(
				"Usage:\n  smithery playground <server>\n  smithery playground -- <command>\n  smithery playground --port <port>",
			),
		)
		process.exit(1)
	} catch (error) {
		if (error instanceof RequestTimeoutError) {
			logWithTimestamp(
				"[Playground] Error: Request timed out. Please check your connection and try again.",
			)
		} else {
			logWithTimestamp(
				`[Playground] Error: ${error instanceof Error ? error.message : error}`,
			)
		}
		console.error(chalk.red("× Playground failed:"), error)
		process.exit(1)
	}
}
