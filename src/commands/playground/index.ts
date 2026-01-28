import { APIConnectionTimeoutError } from "@smithery/api"
import chalk from "chalk"
import ora from "ora"
import { setupTunnelAndPlayground } from "../../lib/dev-lifecycle"
import { saveConfig } from "../../lib/keychain"
import { resolveServer } from "../../lib/registry"
import type { ServerConfig } from "../../types/registry"
import { parseQualifiedName } from "../../utils/cli-utils"
import { resolveUserConfig } from "../../utils/install/user-config"
import { setupProcessLifecycle } from "../../utils/process-lifecycle"
import { prepareStdioConnection } from "../../utils/run/prepare-stdio-connection"
import { ensureApiKey } from "../../utils/runtime"
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
 * @param options.apiKey - Optional Smithery API key for authentication (will be prompted/validated if not provided)
 * @param options.open - Whether to automatically open playground in browser (default: true)
 * @param options.initialMessage - Initial message to send when playground opens
 * @throws {Error} If neither server, command, nor port is provided
 */
export async function playground(options: {
	server?: string
	port?: string
	command?: string
	configOverride?: ServerConfig
	apiKey?: string
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

		// Ensure API key is available and validated
		const apiKey = await ensureApiKey(options.apiKey)

		// Mode 1: Server provided - resolve and run in playground
		if (options.server) {
			const spinner = ora(`Resolving ${options.server}...`).start()
			try {
				const { server, connection } = await resolveServer(
					parseQualifiedName(options.server),
				)
				spinner.succeed(
					chalk.dim(`Successfully resolved ${chalk.cyan(options.server)}`),
				)

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

				// Resolve server configuration (validates, prompts if needed, saves to keychain)
				// Note: resolveUserConfig manages spinner internally (stops for prompts, starts after)
				const config = await resolveUserConfig(
					connection,
					options.server,
					options.configOverride || {},
					spinner,
				)

				// Stop spinner after config resolution (resolveUserConfig may leave it running)
				spinner.stop()

				logWithTimestamp(
					`[Playground] Config resolved${Object.keys(options.configOverride || {}).length > 0 ? " (with overrides)" : ""}`,
				)

				// Save config to keychain if it has values
				if (Object.keys(config).length > 0) {
					await saveConfig(options.server, config)
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
					apiKey,
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
			} catch (error) {
				spinner.fail(`Failed to setup playground for ${options.server}`)
				throw error
			}
		}

		// Mode 2: Command provided - use STDIO mode with raw command
		if (options.command) {
			const port = options.port ? Number.parseInt(options.port, 10) : 6969

			await createStdioPlaygroundRunner(
				{ rawCommand: options.command },
				apiKey,
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
				apiKey,
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
		if (error instanceof APIConnectionTimeoutError) {
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
