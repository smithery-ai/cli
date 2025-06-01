import chalk from "chalk"
import type { ChildProcess } from "node:child_process"
import { startSubprocess } from "../lib/subprocess"
import { setupTunnelAndPlayground } from "../lib/dev-lifecycle"
import { debug } from "../logger"

export async function playground(options: {
	port?: string
	command?: string
	apiKey: string
}): Promise<void> {
	try {
		let finalPort = options.port || "8181"
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
			} catch (error) {
				debug(chalk.yellow("Tunnel already closed"))
			}

			// Kill child process if it exists
			if (childProcess && !childProcess.killed) {
				console.log(chalk.yellow("Stopping subprocess..."))
				childProcess.kill("SIGTERM")

				// Force kill after 5 seconds
				setTimeout(() => {
					if (childProcess && !childProcess.killed) {
						childProcess.kill("SIGKILL")
					}
				}, 5000)
			}

			process.exit(0)
		}

		// Set up signal handlers
		process.on("SIGINT", cleanup)
		process.on("SIGTERM", cleanup)

		// If child process exits unexpectedly, also exit
		if (childProcess) {
			childProcess.on("exit", (code) => {
				if (code !== 0) {
					console.log(chalk.yellow(`\nSubprocess exited with code ${code}`))
					cleanup()
				}
			})
		}

		// Keep the process alive by keeping stdin open
		process.stdin.resume()

		await new Promise<void>(() => {})
	} catch (error) {
		console.error(chalk.red("❌ Playground failed:"), error)
		process.exit(1)
	}
}
