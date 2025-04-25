import type { JSONRPCError } from "@modelcontextprotocol/sdk/types.js"
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js"
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"

export const IDLE_TIMEOUT = 10 * 30 * 1000 // 10 minutes
export const MAX_RETRIES = 3
export const RETRY_DELAY = 1000
export const HEARTBEAT_INTERVAL = 30000 // 30 seconds

// Add timestamp to logs
export const logWithTimestamp = (message: string) => {
	const timestamp = new Date().toISOString()
	console.error(`${timestamp} ${message}`)
}

export type IdleTimeoutManager = {
	updateActivity: () => void
	start: () => void
	stop: () => void
}

export type HeartbeatManager = {
	start: () => void
	stop: () => void
}

export const createHeartbeatManager = (
	send: (message: JSONRPCMessage) => Promise<void>,
	isReady: () => boolean,
): HeartbeatManager => {
	let heartbeatInterval: NodeJS.Timeout | null = null

	const start = () => {
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval)
		}
		heartbeatInterval = setInterval(async () => {
			try {
				if (isReady()) {
					logWithTimestamp("[Runner] Sending heartbeat ping...")
					await send({ jsonrpc: "2.0", method: "ping", params: {} })
				}
			} catch (error) {
				logWithTimestamp(
					`[Runner] Failed to send heartbeat: ${(error as Error).message}`,
				)
			}
		}, HEARTBEAT_INTERVAL)
	}

	const stop = () => {
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval)
			heartbeatInterval = null
		}
	}

	return {
		start,
		stop,
	}
}

export const createIdleTimeoutManager = (
	onTimeout: () => Promise<void>,
): IdleTimeoutManager => {
	let lastActivityTimestamp = Date.now()
	let idleCheckInterval: NodeJS.Timeout | null = null

	const updateActivity = () => {
		lastActivityTimestamp = Date.now()
	}

	const start = () => {
		if (idleCheckInterval) {
			clearInterval(idleCheckInterval)
		}
		updateActivity() // Initialize the timestamp
		idleCheckInterval = setInterval(() => {
			const idleTime = Date.now() - lastActivityTimestamp
			if (idleTime >= IDLE_TIMEOUT) {
				logWithTimestamp(
					`[Runner] Connection idle for ${Math.round(idleTime / 60000)} minutes, initiating shutdown`,
				)
				onTimeout().catch((error) => {
					logWithTimestamp(
						`[Runner] Error during idle timeout cleanup: ${error}`,
					)
					process.exit(1)
				})
			}
		}, 60000) // Check every minute
	}

	const stop = () => {
		if (idleCheckInterval) {
			clearInterval(idleCheckInterval)
			idleCheckInterval = null
		}
	}

	return {
		updateActivity,
		start,
		stop,
	}
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
