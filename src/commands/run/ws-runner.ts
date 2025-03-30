import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js"
import { createSmitheryUrl } from "@smithery/sdk/config.js"
import WebSocket from "ws"
import type {
	JSONRPCMessage,
	JSONRPCError,
} from "@modelcontextprotocol/sdk/types.js"

global.WebSocket = WebSocket as any

type Config = Record<string, unknown>
type Cleanup = () => Promise<void>

const MAX_RETRIES = 3
const RETRY_DELAY = 1000

const createTransport = (
	baseUrl: string,
	config: Config,
	apiKey?: string,
): WebSocketClientTransport => {
	const wsUrl = `${baseUrl.replace(/^http/, "ws")}${baseUrl.endsWith("/") ? "" : "/"}ws`
	const url = createSmitheryUrl(wsUrl, config, apiKey)
	return new WebSocketClientTransport(url)
}

const handleTransportError = (
	errorMessage: JSONRPCError,
	transport: WebSocketClientTransport,
) => {
	switch (errorMessage.error.code) {
		case -32000: // Server-specific: Connection closed
			console.error(
				"[Runner] Connection closed by server - attempting to reconnect...",
			)
			transport.close() // This will trigger onclose handler and retry logic
			return

		case -32700: // Parse Error
		case -32600: // Invalid Request
		case -32601: // Method Not Found
		case -32602: // Invalid Params
		case -32603: // Internal Error
			console.error(errorMessage.error.message)
			return // continue

		default:
			console.error(
				`[Runner] Unexpected error: ${JSON.stringify(errorMessage.error)}`,
			)
			process.exit(1)
	}
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
		console.error(`${context}:`, error.message)
		return error
	}

	const processMessage = async (data: Buffer) => {
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
		console.error(`[Runner] Connecting to WebSocket endpoint: ${baseUrl}`)

		transport.onclose = async () => {
			console.error("[Runner] WebSocket connection closed")
			isReady = false
			if (!isClientInitiatedClose && retryCount++ < MAX_RETRIES) {
				console.error(
					`[Runner] Unexpected disconnect, attempting reconnect (attempt ${retryCount} of ${MAX_RETRIES})...`,
				)
				// Random jitter between 0-1000ms to the exponential backoff
				const jitter = Math.random() * 1000
				const delay = RETRY_DELAY * Math.pow(2, retryCount) + jitter
				await new Promise((resolve) => setTimeout(resolve, delay))

				// Create new transport
				transport = createTransport(baseUrl, config, apiKey)
				await setupTransport()
			} else if (!isClientInitiatedClose) {
				console.error(
					`[Runner] Max reconnection attempts (${MAX_RETRIES}) reached`,
				)
				process.exit(1)
			} else {
				console.error("[Runner] Clean shutdown, not attempting reconnect")
				process.exit(0)
			}
		}

		transport.onerror = (error) => {
			if (error.message.includes("502")) {
				console.error(
					"[Runner] Server returned 502, attempting to reconnect...",
				)
				// Don't exit - let the connection close naturally after retry attempts
				return
			}

			handleError(error, "WebSocket connection error")
			process.exit(1)
		}

		transport.onmessage = (message: JSONRPCMessage) => {
			try {
				if ("error" in message) {
					handleTransportError(message as JSONRPCError, transport)
				}
				console.log(JSON.stringify(message)) // log message to channel
			} catch (error) {
				handleError(error as Error, "Error handling message")
				console.error("[Runner] Message:", JSON.stringify(message))
				console.log(JSON.stringify(message))
			}
		}

		await transport.start()
		isReady = true
		console.error("[Runner] WebSocket connection initiated")
		// Release buffered messages
		await processMessage(Buffer.from(""))
		console.error("[Runner] WebSocket connection established")
	}

	const cleanup = async () => {
		if (isShuttingDown) {
			console.error("[Runner] Cleanup already in progress, skipping...")
			return
		}

		console.error("[Runner] Starting cleanup...")
		isShuttingDown = true
		isClientInitiatedClose = true // Mark this as a clean shutdown

		try {
			console.error("[Runner] Attempting to close transport...")
			await Promise.race([
				transport.close(),
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error("[Runner] Transport close timeout")),
						3000,
					),
				),
			])
			console.error("[Runner] Transport closed successfully")
		} catch (error) {
			handleError(error as Error, "[Runner] Error during cleanup")
		}

		console.error("[Runner] Cleanup completed")
	}

	const handleExit = async () => {
		console.error("[Runner] Shutting down WS Runner...")
		isClientInitiatedClose = true // Mark as clean shutdown before cleanup
		await cleanup()
		if (!isShuttingDown) {
			process.exit(0)
		}
	}

	process.on("SIGINT", handleExit)
	process.on("SIGTERM", handleExit)
	process.on("beforeExit", handleExit)
	process.on("exit", () => {
		console.error("[Runner] Final cleanup on exit")
	})

	process.stdin.on("end", () => {
		console.error("STDIN closed (client disconnected)")
		handleExit().catch((error) => {
			console.error("[Runner] Error during stdin close cleanup:", error)
			process.exit(1)
		})
	})

	process.stdin.on("error", (error) => {
		console.error("[Runner] STDIN error:", error)
		handleExit().catch((error) => {
			console.error("[Runner] Error during stdin error cleanup:", error)
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
