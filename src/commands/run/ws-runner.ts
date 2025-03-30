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
		console.error(`Connecting to WebSocket endpoint: ${baseUrl}`)

		transport.onclose = async () => {
			console.error("WebSocket connection closed")
			isReady = false
			if (!isClientInitiatedClose && retryCount++ < MAX_RETRIES) {
				console.error(
					`Unexpected disconnect, attempting reconnect (attempt ${retryCount} of ${MAX_RETRIES})...`,
				)
				await new Promise((resolve) =>
					setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)),
				)
				// Create new transport
				transport = createTransport(baseUrl, config, apiKey)
				await setupTransport()
			} else if (!isClientInitiatedClose) {
				console.error(`Max reconnection attempts (${MAX_RETRIES}) reached`)
				process.exit(1)
			} else {
				console.error("Clean shutdown, not attempting reconnect")
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
					const errorMessage = message as JSONRPCError
					// Handle connection error - retry connections
					if (errorMessage.error.code === -32000) {
						console.error(
							"[Runner] Connection closed by server - attempting to reconnect...",
						)
						transport.close() // This will trigger onclose handler and retry logic
						return
					}

					// Handle protocol errors - continue since message level
					if (
						errorMessage.error.code === -32602 ||
						errorMessage.error.code === -32600
					) {
						console.error(
							`[Runner] Protocol error: ${errorMessage.error.message}`,
						)
						return
					}

					// Handle configuration errors - exit
					if (
						errorMessage.error.message === "Missing configuration" ||
						errorMessage.error.message === "Invalid configuration"
					) {
						console.error(
							`WebSocket error: ${JSON.stringify(errorMessage.error)}`,
						)
						process.exit(1)
					}
				}

				console.log(JSON.stringify(message)) // log message to channel
			} catch (error) {
				handleError(error as Error, "Error handling message")
				console.error("Raw message data:", JSON.stringify(message))
				console.log(JSON.stringify(message))
			}
		}

		await transport.start()
		isReady = true
		console.error("WebSocket connection established successfully")
		// Release buffered messages
		await processMessage(Buffer.from(""))
	}

	const cleanup = async () => {
		if (isShuttingDown) {
			console.error("Cleanup already in progress, skipping...")
			return
		}

		console.error("Starting cleanup...")
		isShuttingDown = true
		isClientInitiatedClose = true // Mark this as a clean shutdown

		try {
			console.error("Attempting to close transport...")
			await Promise.race([
				transport.close(),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Transport close timeout")), 3000),
				),
			])
			console.error("Transport closed successfully")
		} catch (error) {
			handleError(error as Error, "Error during cleanup")
		}

		console.error("Cleanup completed")
	}

	const handleExit = async () => {
		console.error("Shutting down WS Runner...")
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
		console.error("Final cleanup on exit")
	})

	process.stdin.on("end", () => {
		console.error("STDIN closed (client disconnected)")
		handleExit().catch((error) => {
			console.error("Error during stdin close cleanup:", error)
			process.exit(1)
		})
	})

	process.stdin.on("error", (error) => {
		console.error("STDIN error:", error)
		handleExit().catch((error) => {
			console.error("Error during stdin error cleanup:", error)
			process.exit(1)
		})
	})

	process.stdin.on("data", (data) =>
		processMessage(data).catch((error) =>
			handleError(error, "Error processing message"),
		),
	)

	await setupTransport()

	return cleanup
}
