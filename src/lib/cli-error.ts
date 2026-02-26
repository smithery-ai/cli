import { SmitheryAuthorizationError } from "@smithery/api/mcp"
import pc from "picocolors"
import { createError } from "./errors.js"

/** Extract a readable message from any thrown value. */
export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

/** Print a red error message and exit. If `error` is provided, formats it with API-aware error handling. */
export function fatal(message: string, error?: unknown): never {
	if (error !== undefined) {
		const formatted = createError(error, message)
		console.error(pc.red(formatted.message))
	} else {
		console.error(pc.red(message))
	}
	process.exit(1)
}

/**
 * If the error is an MCP authorization error, print a warning and exit.
 * Call at the top of catch blocks — returns normally if the error is not auth-related.
 */
export function handleMCPAuthError(
	error: unknown,
	connectionId: string,
	options?: { json?: boolean; jsonData?: Record<string, unknown> },
): void {
	if (!(error instanceof SmitheryAuthorizationError)) return

	const msg = `Connection "${connectionId}" requires authorization.`
	if (options?.json) {
		console.log(
			JSON.stringify({
				...options.jsonData,
				error: msg,
				authorizationUrl: error.authorizationUrl,
			}),
		)
	} else {
		console.error(pc.yellow(`${msg} Authorize at:\n${error.authorizationUrl}`))
	}
	process.exit(1)
}
