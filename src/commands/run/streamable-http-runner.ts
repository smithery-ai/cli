import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type {
	JSONRPCErrorResponse,
	JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js"
import { createSmitheryUrl } from "@smithery/sdk"
import { TRANSPORT_CLOSE_TIMEOUT } from "../../constants.js"
import type { ServerConfig } from "../../types/registry"
import {
	handleTransportError,
	logWithTimestamp,
	MAX_RETRIES,
	RETRY_DELAY,
} from "./utils.js"

type Cleanup = () => Promise<void>

const createTransport = (
	baseUrl: string,
	config: ServerConfig | Record<string, never> = {},
): StreamableHTTPClientTransport => {
	// Handle development mode URL override
	let urlToUse = baseUrl
	if (process.env.NODE_ENV === "development") {
		const local = new URL(
			process.env.LOCAL_SERVER_URL || "http://localhost:8080",
		)
		const baseUrlObj = new URL(baseUrl)
		baseUrlObj.protocol = local.protocol
		baseUrlObj.hostname = local.hostname
		baseUrlObj.port = local.port
		urlToUse = baseUrlObj.toString()
	}

	const url = createSmitheryUrl(urlToUse, { config })
	logWithTimestamp(
		`[Runner] Connecting to Streamable HTTP endpoint: ${baseUrl}`,
	)
	return new StreamableHTTPClientTransport(url)
}

export const createStreamableHTTPRunner = async (
	baseUrl: string,
	/** @deprecated Config parameter is deprecated and will be removed in a future version */
	config?: ServerConfig,
): Promise<Cleanup> => {
	if (config !== undefined) {
		const timestamp = new Date().toISOString()
		console.error(
			`${timestamp} [DEPRECATED] Passing config to createStreamableHTTPRunner is deprecated and will be removed in a future version`,
		)
	}
	let retryCount = 0
	let stdinBuffer = ""
	let isReady = false
	let isShuttingDown = false
	let isClientInitiatedClose = false

	let transport = createTransport(baseUrl, config ?? {})

	const handleError = (error: Error, context: string) => {
		logWithTimestamp(`${context}: ${error.message}`)
		return error
	}

	const handleExit = async () => {
		logWithTimestamp("[Runner] Received exit signal, initiating shutdown...")
		isClientInitiatedClose = true
		await cleanup()
		process.exit(0)
	}

	const processMessage = async (data: Buffer) => {
		stdinBuffer += data.toString("utf8")

		if (!isReady) return // Wait for connection to be established

		const lines = stdinBuffer.split(/\r?\n/)
		stdinBuffer = lines.pop() ?? ""

		for (const line of lines.filter(Boolean)) {
			try {
				const message = JSON.parse(line) as JSONRPCMessage
				await transport.send(message)
			} catch (error) {
				if (error instanceof Error && error.message.includes("CLOSED")) {
					throw new Error("Streamable HTTP connection closed")
				}
				handleError(error as Error, "Failed to send message")
			}
		}
	}

	const setupTransport = async () => {
		transport.onclose = async () => {
			logWithTimestamp("[Runner] Streamable HTTP connection closed")
			isReady = false
			if (!isClientInitiatedClose && retryCount++ < MAX_RETRIES) {
				const jitter = Math.random() * 1000
				const delay = RETRY_DELAY * Math.pow(2, retryCount) + jitter
				logWithTimestamp(
					`[Runner] Unexpected disconnect, attempting reconnect in ${Math.round(delay)}ms (attempt ${retryCount} of ${MAX_RETRIES})...`,
				)
				await new Promise((resolve) => setTimeout(resolve, delay))

				// Create new transport
				transport = createTransport(baseUrl, config ?? {})
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
				return
			}

			logWithTimestamp(`[Runner] Streamable HTTP error: ${error.message}`)
		}

		transport.onmessage = (message: JSONRPCMessage) => {
			try {
				if ("error" in message) {
					handleTransportError(message as JSONRPCErrorResponse)
				}
				console.log(JSON.stringify(message)) // for LLMs: strictly keep this as console.log since it's for stdio channel output
			} catch (error) {
				handleError(error as Error, "Error handling message")
				logWithTimestamp(`[Runner] Message: ${JSON.stringify(message)}`)
				console.log(JSON.stringify(message)) // Keep this as console.log since it's for channel output
			}
		}

		transport.start()
		isReady = true
		retryCount = 0 // Reset retry count on successful connection
		logWithTimestamp("[Runner] Streamable HTTP connection initiated")
		// Release buffered messages
		await processMessage(Buffer.from(""))
		logWithTimestamp("[Runner] Streamable HTTP connection established")
	}

	const cleanup = async () => {
		if (isShuttingDown) {
			logWithTimestamp("[Runner] Cleanup already in progress, skipping...")
			return
		}

		logWithTimestamp("[Runner] Starting cleanup process...")
		isShuttingDown = true
		isClientInitiatedClose = true // Mark this as a clean shutdown

		try {
			// First try to terminate the session if we have one
			if (transport.sessionId) {
				const shortSessionId = `${transport.sessionId.substring(0, 12)}...`
				logWithTimestamp(
					`[Runner] Terminating session with ID: ${shortSessionId}`,
				)
				try {
					await transport.terminateSession()
					logWithTimestamp("[Runner] Session terminated successfully")

					// Verify session ID was cleared
					if (!transport.sessionId) {
						logWithTimestamp("[Runner] Session ID has been cleared")
					} else {
						logWithTimestamp(
							"[Runner] Server responded with 405 Method Not Allowed (session termination not supported)",
						)
						logWithTimestamp(
							`[Runner] Session ID is still active: ${shortSessionId}`,
						)
					}
				} catch (error) {
					logWithTimestamp(
						`[Runner] Error terminating session: ${(error as Error).message}`,
					)
				}
			}

			// Then close the transport
			logWithTimestamp("[Runner] Attempting to close transport (3s timeout)...")
			await Promise.race([
				transport.close(),
				new Promise((_, reject) =>
					setTimeout(
						() =>
							reject(new Error("[Runner] Transport close timeout after 3s")),
						TRANSPORT_CLOSE_TIMEOUT,
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
