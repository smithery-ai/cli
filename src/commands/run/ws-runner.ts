import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js"
import { createSmitheryUrl } from "@smithery/sdk/config.js"
import WebSocket from "ws"
import type {
	JSONRPCMessage,
	JSONRPCError,
} from "@modelcontextprotocol/sdk/types.js"
import {
	MAX_RETRIES,
	RETRY_DELAY,
	logWithTimestamp,
	handleTransportError,
	createHeartbeatManager,
	createIdleTimeoutManager,
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

	let transport = createTransport(baseUrl, config, apiKey)

	const handleError = (error: Error, context: string) => {
		logWithTimestamp(`${context}: ${error.message}`)
		return error
	}

	const handleExit = async () => {
		logWithTimestamp("[Runner] Received exit signal, initiating shutdown...")
		isClientInitiatedClose = true
		await cleanup()
		if (!isShuttingDown) {
			process.exit(0)
		}
	}

	const idleManager = createIdleTimeoutManager(handleExit)
	const heartbeatManager = createHeartbeatManager(
		(message) => transport.send(message),
		() => isReady,
	)

	const processMessage = async (data: Buffer) => {
		idleManager.updateActivity() // Update activity state on outgoing message
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
			heartbeatManager.stop()
			idleManager.stop()
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
			idleManager.updateActivity() // Update on incoming message
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
		heartbeatManager.start() // Start heartbeat
		idleManager.start() // Start idle checking
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
		heartbeatManager.stop() // Stop heartbeat
		idleManager.stop() // Stop idle checking

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
