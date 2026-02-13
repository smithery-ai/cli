import chalk from "chalk"

/** Extract a readable message from any thrown value. */
export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

/** Print a red error message and exit. If `error` is provided, appends its message. */
export function fatal(message: string, error?: unknown): never {
	if (error !== undefined) {
		console.error(chalk.red(`${message}: ${errorMessage(error)}`))
	} else {
		console.error(chalk.red(message))
	}
	process.exit(1)
}
