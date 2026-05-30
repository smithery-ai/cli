import {
	AuthenticationError,
	BadRequestError,
	ConflictError,
	PermissionDeniedError,
} from "@smithery/api"

/**
 * Error handling utilities for consistent error message extraction
 */

/**
 * Extracts a user-friendly error message from an unknown error
 * @param error - The error to extract a message from
 * @param defaultMessage - Default message if error message cannot be extracted
 * @returns A string error message
 */
function getErrorMessage(
	error: unknown,
	defaultMessage = "Unknown error",
): string {
	if (error instanceof Error) {
		return error.message || defaultMessage
	}
	if (typeof error === "string") {
		return error
	}
	return defaultMessage
}

/**
 * Creates a formatted Error from an unknown error, handling common API error types
 * Preserves original error context and stack traces when possible
 * @param error - The error to format
 * @param context - Context message for the error (e.g., "Failed to fetch namespaces")
 * @returns A formatted Error instance
 */
export function createError(error: unknown, context: string): Error {
	// Handle specific API error types with user-friendly messages
	if (error instanceof AuthenticationError) {
		const serverMessage = error.message || ""
		const primary = serverMessage
			? `Authentication failed: ${serverMessage}`
			: "Authentication failed: Your API key may be expired or invalid."
		return new Error(`${primary}\nRun "smithery login" to re-authenticate.`, {
			cause: error,
		})
	}
	if (error instanceof PermissionDeniedError) {
		const serverMessage = error.message || ""
		const primary = serverMessage
			? `Permission denied: ${serverMessage}`
			: "Permission denied: Your token lacks the required permissions."
		return new Error(
			`${primary}\nMint a scoped token with "smithery auth token --policy '<constraints>'" or use an API key.`,
			{ cause: error },
		)
	}
	if (error instanceof ConflictError) {
		const errorMessage = getErrorMessage(error, "already exists")
		return new Error(`${context}: ${errorMessage}`, { cause: error })
	}
	if (error instanceof BadRequestError) {
		const invalidModuleMessage = formatInvalidModuleError(error.error)
		if (invalidModuleMessage) {
			return new Error(`${context}: ${invalidModuleMessage}`, { cause: error })
		}
		const errorMessage = getErrorMessage(error, "Invalid request")
		return new Error(`${context}: ${errorMessage}`, { cause: error })
	}
	// Re-throw other Error instances as-is (preserves stack trace and context)
	if (error instanceof Error) {
		return error
	}
	// Format unknown errors
	const errorMessage = getErrorMessage(error, context)
	return new Error(errorMessage)
}

function formatInvalidModuleError(errorBody: unknown): string | undefined {
	if (!isRecord(errorBody) || !isRecord(errorBody.error)) {
		return undefined
	}
	const payload = errorBody.error
	if (payload.code !== "invalid_module") {
		return undefined
	}

	const message =
		typeof payload.message === "string"
			? payload.message
			: "The submitted module could not be installed."
	const diagnostics = Array.isArray(payload.diagnostics)
		? payload.diagnostics
				.map(formatDynamicModuleDiagnostic)
				.filter((diagnostic) => diagnostic.length > 0)
		: []

	if (diagnostics.length === 0) {
		return message
	}

	return `${message}\n${diagnostics.join("\n")}`
}

function formatDynamicModuleDiagnostic(value: unknown): string {
	if (!isRecord(value)) {
		return ""
	}
	const path = typeof value.path === "string" ? value.path : "<unknown>"
	const line = typeof value.line === "number" ? value.line : 1
	const column = typeof value.column === "number" ? value.column : 1
	const message =
		typeof value.message === "string" ? value.message : "Invalid module source."
	return `${path}:${line}:${column} ${message}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}
