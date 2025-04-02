import type { JSONRPCError } from "@modelcontextprotocol/sdk/types.js"

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
		case -32000: // Server-specific: Connection closed
			logWithTimestamp(
				`[Runner] Connection closed by server (code: -32000). Details: ${JSON.stringify(errorMessage.error)}`,
			)
			logWithTimestamp(
				"[Runner] Attempting to reconnect after server-initiated close...",
			)
			return // natural reconnection logic

		case -32700: // Parse Error
		case -32600: // Invalid Request
		case -32601: // Method Not Found
		case -32602: // Invalid Params
		case -32603: // Internal Error
			return // natural reconnection logic

		default:
			logWithTimestamp(
				`[Runner] Unexpected protocol error: ${JSON.stringify(errorMessage.error)}`,
			)
			process.exit(1)
	}
}
