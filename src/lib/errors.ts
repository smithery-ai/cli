import {
	AuthenticationError,
	BadRequestError,
	ConflictError,
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
		const errorMessage = getErrorMessage(error, "Unauthorized: Invalid API key")
		return new Error(errorMessage, { cause: error })
	}
	if (error instanceof ConflictError) {
		const errorMessage = getErrorMessage(error, "already exists")
		return new Error(`${context}: ${errorMessage}`, { cause: error })
	}
	if (error instanceof BadRequestError) {
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
