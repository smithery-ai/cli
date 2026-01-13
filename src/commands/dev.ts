import { existsSync } from "node:fs"
import { join } from "node:path"
import chalk from "chalk"
import { DEFAULT_PORT } from "../constants"
import { buildServer } from "../lib/build"
import { setupTunnelAndPlayground } from "../lib/dev-lifecycle"
import { createDevServer } from "../lib/dev-server"
import { debug } from "../lib/logger"
import { setupProcessLifecycle } from "../utils/process-lifecycle"
import { ensureApiKey } from "../utils/runtime"

interface DevOptions {
	entryFile?: string
	port?: string
	key?: string
	tunnel?: boolean
	open?: boolean
	initialMessage?: string
	minify?: boolean
}

export async function dev(options: DevOptions = {}): Promise<void> {
	try {
		// Ensure API key is available
		const apiKey = await ensureApiKey(options.key)

		const smitheryDir = join(".smithery")
		const outFile = join(smitheryDir, "bundle", "module.js")
		const finalPort = options.port || DEFAULT_PORT.toString()
		const shouldSetupTunnel = options.tunnel !== false

		let devServer: Awaited<ReturnType<typeof createDevServer>> | undefined
		let tunnelListener: { close: () => Promise<void> } | undefined
		let isFirstBuild = true

		// Function to start/restart the server using Miniflare
		const startServer = async () => {
			// If server exists, just reload it
			if (devServer) {
				await devServer.reload()
				return
			}

			// Ensure the output file exists
			await new Promise<void>((resolve) => {
				if (existsSync(outFile)) {
					return resolve()
				}
				const interval = setInterval(() => {
					if (existsSync(outFile)) {
						clearInterval(interval)
						resolve()
					}
				}, 50)
			})

			// Display a user-friendly message on first start
			if (isFirstBuild) {
				console.log(chalk.dim("> Starting local development server..."))
			}

			// Start new server with Miniflare wrapper
			devServer = await createDevServer({
				port: Number.parseInt(finalPort, 10),
				modulePath: outFile,
			})

			// Start tunnel and open playground on first successful start
			if (isFirstBuild) {
				console.log(
					chalk.dim(`> Server starting on port ${chalk.green(finalPort)}`),
				)
				if (shouldSetupTunnel) {
					setupTunnelAndPlayground(finalPort, apiKey, options.open !== false)
						.then(({ listener }) => {
							tunnelListener = listener
							isFirstBuild = false
						})
						.catch((error) => {
							console.error(chalk.red("× Failed to start tunnel:"), error)
						})
				} else {
					isFirstBuild = false
				}
			}
		}

		// Set up build with watch mode
		const buildContext = await buildServer({
			outFile,
			entryFile: options.entryFile,
			watch: true,
			minify: false, // Always disable minification in dev mode
			transport: "shttp",
			onRebuild: () => {
				startServer()
			},
		})

		// Handle cleanup on exit
		const cleanup = async () => {
			console.log(chalk.yellow("\no/ Shutting down server..."))

			// Stop watching
			if (buildContext && "dispose" in buildContext) {
				await buildContext.dispose()
			}

			// Close dev server
			if (devServer) {
				await devServer.close()
			}

			// Close tunnel
			if (tunnelListener) {
				try {
					await tunnelListener.close()
					debug(chalk.green("Tunnel closed"))
				} catch (_error) {
					debug(chalk.yellow("Tunnel already closed"))
				}
			}
		}

		// Set up process lifecycle management
		setupProcessLifecycle({
			cleanupFn: cleanup,
			processName: "server",
		})
	} catch (error) {
		console.error(chalk.red("× Dev server failed:"), error)
		process.exit(1)
	}
}
