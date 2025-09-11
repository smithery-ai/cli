import type { JSONRPCError } from "@modelcontextprotocol/sdk/types.js"
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js"
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"

// Time in milliseconds before considering a connection idle
export const IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes
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

export type IdleTimeoutCallbacks = {
	onIdleDetected?: () => void
	onActivityResumed?: () => void
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

/**
 * Creates an idle timeout manager that monitors activity and triggers callbacks
 * when the connection becomes idle or resumes activity.
 *
 * @param onTimeout - Legacy callback for timeout (kept for compatibility)
 * @param callbacks - Optional callbacks for idle state changes
 * @param callbacks.onIdleDetected - Called when idle timeout is reached (after 10 minutes)
 * @param callbacks.onActivityResumed - Called when activity resumes after being idle
 */
export const createIdleTimeoutManager = (
	onTimeout: () => Promise<void>,
	callbacks?: IdleTimeoutCallbacks,
): IdleTimeoutManager => {
	let lastActivityTimestamp = Date.now()
	let idleCheckInterval: NodeJS.Timeout | null = null
	let isIdle = false

	const updateActivity = () => {
		lastActivityTimestamp = Date.now()
		// Notify when activity resumes after being idle
		if (isIdle && callbacks?.onActivityResumed) {
			callbacks.onActivityResumed()
			isIdle = false
		}
	}

	const start = () => {
		if (idleCheckInterval) {
			clearInterval(idleCheckInterval)
		}
		updateActivity() // Initialize the timestamp
		idleCheckInterval = setInterval(() => {
			const idleTime = Date.now() - lastActivityTimestamp
			if (idleTime >= IDLE_TIMEOUT && !isIdle) {
				logWithTimestamp(
					`[Runner] Connection idle for ${Math.round(idleTime / 60000)} minutes`,
				)
				isIdle = true
				// Notify that idle has been detected
				if (callbacks?.onIdleDetected) {
					callbacks.onIdleDetected()
				}
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
