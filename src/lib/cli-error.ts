import chalk from "chalk"
import { createError } from "./errors.js"

/** Extract a readable message from any thrown value. */
export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

/** Print a red error message and exit. If `error` is provided, formats it with API-aware error handling. */
export function fatal(message: string, error?: unknown): never {
	if (error !== undefined) {
		const formatted = createError(error, message)
		console.error(chalk.red(formatted.message))
	} else {
		console.error(chalk.red(message))
	}
	process.exit(1)
}
