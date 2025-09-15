import type { ChildProcess } from "node:child_process"
import { FORCE_KILL_TIMEOUT } from "../constants"

export interface ChildProcessCleanupOptions {
	childProcess: ChildProcess
	processName: string
}

/**
 * Handles graceful shutdown of child processes with fallback to force kill.
 * This utility provides consistent cleanup behavior across all commands.
 */
export async function cleanupChildProcess(
	options: ChildProcessCleanupOptions,
): Promise<void> {
	const { childProcess, processName } = options

	// Skip if process is already killed or doesn't exist
	if (!childProcess || childProcess.killed) {
		return
	}

	// console.log(chalk.yellow(`Stopping ${processName}...`))

	// Wait for process to exit after sending SIGTERM
	const processExited = new Promise<void>((resolve) => {
		const exitHandler = () => {
			childProcess.removeListener("exit", exitHandler)
			resolve()
		}
		childProcess.on("exit", exitHandler)
	})

	// Send graceful termination signal
	try {
		childProcess.kill("SIGTERM")
	} catch (_error) {
		// Process might already be dead, that's fine
		return
	}

	// Set up force kill timeout
	const forceKill = new Promise<void>((resolve) => {
		setTimeout(() => {
			if (childProcess && !childProcess.killed) {
				try {
					childProcess.kill("SIGKILL")
				} catch (_error) {
					// Process might already be dead, that's fine
				}
			}
			resolve()
		}, FORCE_KILL_TIMEOUT)
	})

	// Wait for either graceful exit or force kill timeout
	await Promise.race([processExited, forceKill])
}
