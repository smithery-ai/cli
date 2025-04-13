import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js"
import { createSmitheryUrl } from "@smithery/sdk/config.js"
import WebSocket from "ws"
import type {
	JSONRPCMessage,
	JSONRPCError,
} from "@modelcontextprotocol/sdk/types.js"
import {
	IDLE_TIMEOUT,
	MAX_RETRIES,
	RETRY_DELAY,
	logWithTimestamp,
	handleTransportError,
} from "./runner-utils.js"

global.WebSocket = WebSocket as any

type Config = Record<string, unknown>
type Cleanup = () => Promise<void>

const createTransport = (
	baseUrl: string,
	config: Config,
	apiKey?: string,
): WebSocketClientTransport => {
	const wsUrl = `${baseUrl.replace(/^http/, "ws")}${baseUrl.endsWith("/") ? "" : "/"}ws`
	const url = createSmitheryUrl(wsUrl, config, apiKey)
	return new WebSocketClientTransport(url)
}

export const createWSRunner = async (
	baseUrl: string,
	config: Config,
	apiKey?: string,
): Promise<Cleanup> => {
	let retryCount = 0
	let stdinBuffer = ""
	let isReady = false
	let isShuttingDown = false
	let isClientInitiatedClose = false
	let heartbeatInterval: NodeJS.Timeout | null = null
	let lastActivityTimestamp: number = Date.now()
	let idleCheckInterval: NodeJS.Timeout | null = null

	let transport = createTransport(baseUrl, config, apiKey)

	/* Keeps websocket connection alive */
	const startHeartbeat = () => {
		// Ping every 30 seconds (well before the 100s timeout)
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval)
		}
		heartbeatInterval = setInterval(async () => {
			try {
				if (isReady) {
					// logWithTimestamp("[Runner] Sending heartbeat ping")
					await transport.send({ jsonrpc: "2.0", method: "ping", params: {} })
				}
			} catch (error) {
				logWithTimestamp(
					`[Runner] Failed to send heartbeat: ${(error as Error).message}`,
				)
			}
		}, 30000)
	}

	const stopHeartbeat = () => {
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval)
			heartbeatInterval = null
		}
	}

	const handleError = (error: Error, context: string) => {
		logWithTimestamp(`${context}: ${error.message}`)
		return error
	}

	const updateLastActivity = () => {
		lastActivityTimestamp = Date.now()
	}

	/* Starts and monitors connection idle state */
	const startIdleCheck = () => {
		if (idleCheckInterval) {
			clearInterval(idleCheckInterval)
		}
		updateLastActivity() // Initialize the timestamp
		idleCheckInterval = setInterval(() => {
			const idleTime = Date.now() - lastActivityTimestamp
			if (idleTime >= IDLE_TIMEOUT) {
				logWithTimestamp(
					`[Runner] Connection idle for ${Math.round(idleTime / 60000)} minutes, initiating shutdown`,
				)
				handleExit().catch((error) => {
					logWithTimestamp(
						`[Runner] Error during idle timeout cleanup: ${error}`,
					)
					process.exit(1)
				})
			}
		}, 60000) // Check every minute
	}

	const stopIdleCheck = () => {
		if (idleCheckInterval) {
			clearInterval(idleCheckInterval)
			idleCheckInterval = null
		}
	}

	const processMessage = async (data: Buffer) => {
		updateLastActivity() // Update activity state on outgoing message
		stdinBuffer += data.toString("utf8")

		if (!isReady) return // Wait for connection to be established

		const lines = stdinBuffer.split(/\r?\n/)
		stdinBuffer = lines.pop() ?? ""

		for (const line of lines.filter(Boolean)) {
			try {
				await transport.send(JSON.parse(line))
			} catch (error) {
				if (error instanceof Error && error.message.includes("CLOSED")) {
					throw new Error("WebSocket closed")
				}
				handleError(error as Error, "Failed to send message")
			}
		}
	}

	const setupTransport = async () => {
		logWithTimestamp(`[Runner] Connecting to WebSocket endpoint: ${baseUrl}`)

		transport.onclose = async () => {
			logWithTimestamp("[Runner] WebSocket connection closed")
			isReady = false
			stopHeartbeat()
			if (!isClientInitiatedClose && retryCount++ < MAX_RETRIES) {
				const jitter = Math.random() * 1000
				const delay = RETRY_DELAY * Math.pow(2, retryCount) + jitter
				logWithTimestamp(
					`[Runner] Unexpected disconnect, attempting reconnect in ${Math.round(delay)}ms (attempt ${retryCount} of ${MAX_RETRIES})...`,
				)
				await new Promise((resolve) => setTimeout(resolve, delay))

				// Create new transport
				transport = createTransport(baseUrl, config, apiKey)
				logWithTimestamp(
					"[Runner] Created new transport instance after disconnect",
				)
				await setupTransport()
			} else if (!isClientInitiatedClose) {
				logWithTimestamp(
					`[Runner] Max reconnection attempts (${MAX_RETRIES}) reached - giving up`,
				)
				process.exit(1)
			} else {
				logWithTimestamp(
					"[Runner] Clean shutdown detected, performing graceful exit",
				)
				process.exit(0)
			}
		}

		transport.onerror = (error) => {
			if (error.message.includes("502")) {
				logWithTimestamp("[Runner] Server returned 502 Bad Gateway")
				logWithTimestamp(
					`[Runner] Connection state before 502 retry - isReady: ${isReady}`,
				)
				return
			}

			logWithTimestamp(`[Runner] WebSocket error: ${error.message}`)
			// process.exit(1) // reconnection logic
		}

		transport.onmessage = (message: JSONRPCMessage) => {
			updateLastActivity() // Update on incoming message
			try {
				if ("error" in message) {
					handleTransportError(message as JSONRPCError)
				}
				console.log(JSON.stringify(message)) // Strictly keep this as console.log since it's for channel output
			} catch (error) {
				handleError(error as Error, "Error handling message")
				logWithTimestamp(`[Runner] Message: ${JSON.stringify(message)}`)
				console.log(JSON.stringify(message)) // Keep this as console.log since it's for channel output
			}
		}

		await transport.start()
		isReady = true
		logWithTimestamp("[Runner] WebSocket connection initiated")
		startHeartbeat() // Start heartbeat
		startIdleCheck() // Start idle checking
		// Release buffered messages
		await processMessage(Buffer.from(""))
		logWithTimestamp("[Runner] WebSocket connection established")
	}

	const cleanup = async () => {
		if (isShuttingDown) {
			logWithTimestamp(
				"[Runner] Cleanup already in progress, skipping duplicate cleanup...",
			)
			return
		}

		logWithTimestamp("[Runner] Starting cleanup process...")
		isShuttingDown = true
		isClientInitiatedClose = true // Mark this as a clean shutdown
		stopHeartbeat() // Stop heartbeat
		stopIdleCheck() // Stop idle checking

		try {
			logWithTimestamp("[Runner] Attempting to close transport (3s timeout)...")
			await Promise.race([
				transport.close(),
				new Promise((_, reject) =>
					setTimeout(
						() =>
							reject(new Error("[Runner] Transport close timeout after 3s")),
						3000,
					),
				),
			])
			logWithTimestamp("[Runner] Transport closed successfully")
		} catch (error) {
			logWithTimestamp(
				`[Runner] Error during transport cleanup: ${(error as Error).message}`,
			)
		}

		logWithTimestamp("[Runner] Cleanup completed")
	}

	const handleExit = async () => {
		logWithTimestamp("[Runner] Received exit signal, initiating shutdown...")
		// logWithTimestamp(`[Runner] Exit state - isReady: ${isReady}, isShuttingDown: ${isShuttingDown}`)
		isClientInitiatedClose = true
		await cleanup()
		if (!isShuttingDown) {
			process.exit(0)
		}
	}

	process.on("SIGINT", handleExit)
	process.on("SIGTERM", handleExit)
	process.on("beforeExit", handleExit)
	process.on("exit", () => {
		logWithTimestamp("[Runner] Final cleanup on exit")
	})

	process.stdin.on("end", () => {
		logWithTimestamp("[Runner] STDIN closed (client disconnected)")
		handleExit().catch((error) => {
			logWithTimestamp(`[Runner] Error during stdin close cleanup: ${error}`)
			process.exit(1)
		})
	})

	process.stdin.on("error", (error) => {
		logWithTimestamp(`[Runner] STDIN error: ${error.message}`)
		handleExit().catch((error) => {
			logWithTimestamp(`[Runner] Error during stdin error cleanup: ${error}`)
			process.exit(1)
		})
	})

	process.stdin.on("data", (data) =>
		processMessage(data).catch((error) =>
			handleError(error, "[Runner] Error processing message"),
		),
	)

	await setupTransport()

	return cleanup
}
