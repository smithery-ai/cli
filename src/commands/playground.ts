import chalk from "chalk"
import { setupTunnelAndPlayground } from "../lib/dev-lifecycle"
import { setupProcessLifecycle } from "../utils/process-lifecycle"
import { createArbitraryCommandRunner } from "./run/arbitrary-command-runner"

/**
 * Opens the MCP playground in a browser, supporting two modes:
 *
 * 1. **STDIO mode**: Runs STDIO command -> creates local HTTP bridge server (translates HTTP ↔ STDIO) -> tunnels and exposes to playground
 *
 * 2. **HTTP mode**: Tunnels existing local HTTP server -> exposes to playground
 *
 * In both modes, sets up a tunnel to expose the local server and optionally opens
 * the playground in the browser. Handles cleanup on process exit.
 *
 * @param options - Configuration options
 * @param options.port - Port number (default: 6969 for STDIO, DEFAULT_PORT for HTTP)
 * @param options.command - Command to run as STDIO MCP server (triggers STDIO mode)
 * @param options.apiKey - Smithery API key for authentication
 * @param options.open - Whether to automatically open playground in browser (default: true)
 * @param options.initialMessage - Initial message to send when playground opens
 * @throws {Error} If neither command nor port is provided
 */
export async function playground(options: {
	port?: string
	command?: string
	apiKey: string
	open?: boolean
	initialMessage?: string
}): Promise<void> {
	try {
		// If command is provided, use STDIO mode (arbitrary-command-runner)
		if (options.command) {
			const port = options.port ? Number.parseInt(options.port, 10) : 6969

			await createArbitraryCommandRunner(options.command, options.apiKey, {
				port,
				open: options.open !== false,
				initialMessage: options.initialMessage,
			})

			// Keep the process alive
			process.stdin.resume()
			await new Promise<void>(() => {})
			return
		}

		// If no command is provided, require a port to be specified (HTTP mode)
		if (!options.port) {
			console.error(
				chalk.red("× Port is required when no command is specified."),
			)
			console.error(
				chalk.yellow(
					"Use --port <port> to specify the port where your service is running, or provide a command: smithery playground -- <command>",
				),
			)
			process.exit(1)
		}

		// HTTP mode: tunnel existing server
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
	} catch (error) {
		console.error(chalk.red("× Playground failed:"), error)
		process.exit(1)
	}
}
