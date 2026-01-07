import chalk from "chalk"

export interface ProcessLifecycleOptions {
	cleanupFn: () => Promise<void>
	processName?: string
	showExitMessage?: boolean
	showInstructions?: boolean
}

/**
 * Sets up proper signal handling and process lifecycle management for long-running commands.
 * This utility ensures that processes respond properly to Ctrl+C and other termination signals.
 *
 * Based on the pattern used in runner files (stdio-runner.ts)
 */
export function setupProcessLifecycle(options: ProcessLifecycleOptions): void {
	const { cleanupFn, processName = "server", showExitMessage = true } = options

	let isExiting = false
	const handleExit = async () => {
		if (isExiting) {
			return // Prevent duplicate cleanup calls
		}
		isExiting = true

		if (showExitMessage) {
			console.log(chalk.gray(" Received exit signal, shutting down..."))
		}
		await cleanupFn()
		console.log(chalk.blue("🚀 Run 'smithery deploy' to publish on Smithery"))
		process.exit(0)
	}

	// Set up signal handlers
	process.on("SIGINT", handleExit)
	process.on("SIGTERM", handleExit)

	// Keep process alive by listening to stdin (like the runners do)
	process.stdin.resume()
	process.stdin.on("end", handleExit)
	process.stdin.on("error", handleExit)

	// Show user instructions
	console.log(chalk.gray(`Press Ctrl+C to stop the ${processName}`))
}
