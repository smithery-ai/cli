import type { JSONRPCError } from "@modelcontextprotocol/sdk/types.js"
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js"

export const IDLE_TIMEOUT = 15 * 60 * 1000 // 15 minutes in milliseconds
export const MAX_RETRIES = 3
export const RETRY_DELAY = 1000

// Add timestamp to logs
export const logWithTimestamp = (message: string) => {
	const timestamp = new Date().toISOString()
	console.error(`${timestamp} ${message}`)
}

export const handleTransportError = (errorMessage: JSONRPCError) => {
	switch (errorMessage.error.code) {
		case ErrorCode.ConnectionClosed: // Server-specific: Connection closed
			logWithTimestamp(
				`[Runner] Connection closed by server (code: ${ErrorCode.ConnectionClosed}). Details: ${JSON.stringify(errorMessage.error)}`,
			)
			logWithTimestamp(
				"[Runner] Attempting to reconnect after server-initiated close...",
			)
			return // natural reconnection logic for ws
		case ErrorCode.ParseError:
		case ErrorCode.InvalidRequest:
		case ErrorCode.MethodNotFound:
		case ErrorCode.InvalidParams:
		case ErrorCode.InternalError:
			return
		default:
			logWithTimestamp(
				`[Runner] Unexpected protocol error: ${JSON.stringify(errorMessage.error)}`,
			)
			return // Let the error flow naturally through the error handling chain
	}
}
