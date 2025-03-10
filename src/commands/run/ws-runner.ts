// import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js"
// import { createSmitheryUrl } from "@smithery/sdk/config.js"
import WebSocket from "ws"
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { ProxyTransport } from "./proxy-transport"

global.WebSocket = WebSocket as any

type Config = Record<string, unknown>
type Cleanup = () => Promise<void>

const MAX_RETRIES = 3
const RETRY_DELAY = 1000

const createTransport = (baseUrl: string, config: Config): Transport => {
	return new ProxyTransport(baseUrl, config, {
		idleTimeout: 5 * 60 * 1000, // 5 minutes
		maxBuffer: 100,
	})
}

export const createWSRunner = async (
	baseUrl: string,
	config: Config,
): Promise<Cleanup> => {
	let retryCount = 0
	let stdinBuffer = ""
	let isReady = false

	let transport = createTransport(baseUrl, config)

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
			// Retry connection
			isReady = false

			if (retryCount++ < MAX_RETRIES) {
				await new Promise((resolve) =>
					setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)),
				)
				// Create new transport
				transport = createTransport(baseUrl, config)
				await setupTransport()
			} else {
				console.error(`Max reconnection attempts (${MAX_RETRIES}) reached`)
				process.exit(1)
			}
		}

		transport.onerror = (error) => {
			handleError(error, "WebSocket connection error")
			process.exit(1)
		}

		transport.onmessage = (message) => {
			try {
				if ("error" in message) {
					// If we receive an error regarding misconfiguration, close the connection
					console.error(`WebSocket error: ${JSON.stringify(message.error)}`)
					if (
						message.error.message === "Missing configuration" ||
						message.error.message === "Invalid configuration"
					) {
						process.exit(1)
					}
				}

				console.log(JSON.stringify(message))
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
		console.error("Starting cleanup...")
		await transport
			.close()
			.catch((error) => handleError(error, "Error during cleanup"))
		console.error("Cleanup completed")
	}

	const handleExit = async () => {
		console.error("Shutting down WS Runner...")
		await cleanup()
		process.exit(0)
	}

	// Setup event handlers
	process.on("SIGINT", handleExit)
	process.on("SIGTERM", handleExit)
	process.stdin.on("data", (data) =>
		processMessage(data).catch((error) =>
			handleError(error, "Error processing message"),
		),
	)

	// Start the transport
	await setupTransport()

	return cleanup
}
