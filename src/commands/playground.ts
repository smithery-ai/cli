import type { ChildProcess } from "node:child_process"
import chalk from "chalk"
import { DEFAULT_PORT } from "../constants"
import { setupTunnelAndPlayground } from "../lib/dev-lifecycle"
import { debug } from "../lib/logger"
import { startSubprocess } from "../lib/subprocess"
import { cleanupChildProcess } from "../utils/child-process-cleanup"
import { setupProcessLifecycle } from "../utils/process-lifecycle"

export async function playground(options: {
	port?: string
	command?: string
	apiKey: string
}): Promise<void> {
	try {
		// If no command is provided, require a port to be specified
		if (!options.command && !options.port) {
			console.error(
				chalk.red("❌ Port is required when no command is specified."),
			)
			console.error(
				chalk.yellow(
					"Use --port <port> to specify the port where your service is running.",
				),
			)
			process.exit(1)
		}

		let finalPort = options.port || DEFAULT_PORT.toString()
		let childProcess: ChildProcess | undefined

		// If command is provided, start it and detect port
		if (options.command) {
			const { process: proc, detectedPort } = await startSubprocess(
				options.command,
				finalPort,
			)
			childProcess = proc
			finalPort = detectedPort
		}

		// Start tunnel and open playground using shared function
		const { listener } = await setupTunnelAndPlayground(
			finalPort,
			options.apiKey,
		)

		// Handle cleanup on exit
		const cleanup = async () => {
			console.log(chalk.yellow("\n👋 Shutting down tunnel..."))

			// Close tunnel
			try {
				await listener.close()
				debug(chalk.green("Tunnel closed"))
			} catch (_error) {
				debug(chalk.yellow("Tunnel already closed"))
			}

			// Kill child process if it exists
			if (childProcess) {
				await cleanupChildProcess({
					childProcess,
					processName: "server",
				})
			}
		}

		// Set up process lifecycle management
		setupProcessLifecycle({
			cleanupFn: cleanup,
			processName: "playground",
		})

		// If child process exits unexpectedly, also exit
		if (childProcess) {
			childProcess.on("exit", (code) => {
				if (code !== 0) {
					console.log(chalk.yellow(`\nSubprocess exited with code ${code}`))
					cleanup().then(() => process.exit(0))
				}
			})
		}
	} catch (error) {
		console.error(chalk.red("❌ Playground failed:"), error)
		process.exit(1)
	}
}
