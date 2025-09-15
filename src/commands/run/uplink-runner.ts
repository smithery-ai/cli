import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type {
	JSONRPCError,
	JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js"
import chalk from "chalk"
import { DEFAULT_PORT, TRANSPORT_CLOSE_TIMEOUT } from "../../constants.js"
import { setupTunnelAndPlayground } from "../../lib/dev-lifecycle.js"
import type { ServerConfig } from "../../types/registry.js"
import { createStreamableHTTPTransportUrl } from "../../utils/url-utils.js"
import {
	createHeartbeatManager,
	createIdleTimeoutManager,
	handleTransportError,
	logWithTimestamp,
	MAX_RETRIES,
	RETRY_DELAY,
} from "./runner-utils.js"

interface UplinkOptions {
	open?: boolean
	initialMessage?: string
}

type Cleanup = () => Promise<void>

const createTransport = (
	baseUrl: string,
	apiKey: string,
	config: ServerConfig,
	profile: string | undefined,
): StreamableHTTPClientTransport => {
	const url = createStreamableHTTPTransportUrl(baseUrl, apiKey, config, profile)
	logWithTimestamp(
		`[Uplink Runner] Connecting to Streamable HTTP endpoint: ${baseUrl}`,
	)
	return new StreamableHTTPClientTransport(url)
}

export const createUplinkRunner = async (
	baseUrl: string,
	apiKey: string,
	config: ServerConfig,
	profile: string | undefined,
	options: UplinkOptions = {},
): Promise<Cleanup> => {
	let retryCount = 0
	let stdinBuffer = ""
	let isReady = false
	let isShuttingDown = false
	let isClientInitiatedClose = false
	let tunnelListener: { close: () => Promise<void> } | undefined

	let transport = createTransport(baseUrl, apiKey, config, profile)

	const handleError = (error: Error, context: string) => {
		logWithTimestamp(`${context}: ${error.message}`)
		return error
	}

	const handleExit = async () => {
		logWithTimestamp(
			"[Uplink Runner] Received exit signal, initiating shutdown...",
		)
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
			logWithTimestamp("[Uplink Runner] Streamable HTTP connection closed")
			isReady = false
			heartbeatManager.stop()
			if (!isClientInitiatedClose && retryCount++ < MAX_RETRIES) {
				const jitter = Math.random() * 1000
				const delay = RETRY_DELAY * Math.pow(2, retryCount) + jitter
				logWithTimestamp(
					`[Uplink Runner] Unexpected disconnect, attempting reconnect in ${Math.round(delay)}ms (attempt ${retryCount} of ${MAX_RETRIES})...`,
				)
				await new Promise((resolve) => setTimeout(resolve, delay))

				// Create new transport
				transport = createTransport(baseUrl, apiKey, config, profile)
				logWithTimestamp(
					"[Uplink Runner] Created new transport instance after disconnect",
				)
				await setupTransport()
			} else if (!isClientInitiatedClose) {
				logWithTimestamp(
					`[Uplink Runner] Max reconnection attempts (${MAX_RETRIES}) reached - giving up`,
				)
				process.exit(1)
			} else {
				logWithTimestamp(
					"[Uplink Runner] Clean shutdown detected, performing graceful exit",
				)
				process.exit(0)
			}
		}

		transport.onerror = (error) => {
			if (error.message.includes("502")) {
				logWithTimestamp("[Uplink Runner] Server returned 502 Bad Gateway")
				return
			}

			logWithTimestamp(
				`[Uplink Runner] Streamable HTTP error: ${error.message}`,
			)
		}

		transport.onmessage = (message: JSONRPCMessage) => {
			// Only update activity for non-heartbeat messages
			if (
				"method" in message &&
				!(message.method === "ping" || message.method === "pong")
			) {
				idleManager.updateActivity() // Update on incoming message
			}
			try {
				if ("error" in message) {
					handleTransportError(message as JSONRPCError)
				}
				console.log(JSON.stringify(message)) // for LLMs: strictly keep this as console.log since it's for stdio channel output
			} catch (error) {
				handleError(error as Error, "Error handling message")
				logWithTimestamp(`[Uplink Runner] Message: ${JSON.stringify(message)}`)
				console.log(JSON.stringify(message)) // Keep this as console.log since it's for channel output
			}
		}

		transport.start()
		isReady = true
		retryCount = 0 // Reset retry count on successful connection
		logWithTimestamp("[Uplink Runner] Streamable HTTP connection initiated")

		// Release buffered messages
		await processMessage(Buffer.from(""))
		logWithTimestamp("[Uplink Runner] Streamable HTTP connection established")

		heartbeatManager.start() // Start heartbeat after connection is fully established
		idleManager.start() // Start idle check

		// Set up tunnel and playground after successful connection
		try {
			console.log(
				chalk.green("✅ Server connection established, setting up uplink..."),
			)
			const { listener } = await setupTunnelAndPlayground(
				DEFAULT_PORT.toString(), // Use a default port for the tunnel
				apiKey,
				options.open !== false,
				options.initialMessage || "Say hello to the world!",
			)
			tunnelListener = listener
			console.log(
				chalk.green("🚀 Uplink tunnel established and playground opened"),
			)
		} catch (error) {
			logWithTimestamp(`[Uplink Runner] Failed to setup tunnel: ${error}`)
			throw error
		}
	}

	const cleanup = async () => {
		if (isShuttingDown) {
			logWithTimestamp(
				"[Uplink Runner] Cleanup already in progress, skipping...",
			)
			return
		}

		logWithTimestamp("[Uplink Runner] Starting cleanup process...")
		isShuttingDown = true
		isClientInitiatedClose = true // Mark this as a clean shutdown
		heartbeatManager.stop() // Stop heartbeat
		idleManager.stop() // Stop idle check

		// Close tunnel first
		if (tunnelListener) {
			try {
				logWithTimestamp("[Uplink Runner] Closing tunnel...")
				await tunnelListener.close()
				logWithTimestamp("[Uplink Runner] Tunnel closed successfully")
			} catch (error) {
				logWithTimestamp(`[Uplink Runner] Error closing tunnel: ${error}`)
			}
		}

		try {
			// First try to terminate the session if we have one
			if (transport.sessionId) {
				const shortSessionId = `${transport.sessionId.substring(0, 12)}...`
				logWithTimestamp(
					`[Uplink Runner] Terminating session with ID: ${shortSessionId}`,
				)
				try {
					await transport.terminateSession()
					logWithTimestamp("[Uplink Runner] Session terminated successfully")

					// Verify session ID was cleared
					if (!transport.sessionId) {
						logWithTimestamp("[Uplink Runner] Session ID has been cleared")
					} else {
						logWithTimestamp(
							"[Uplink Runner] Server responded with 405 Method Not Allowed (session termination not supported)",
						)
						logWithTimestamp(
							`[Uplink Runner] Session ID is still active: ${shortSessionId}`,
						)
					}
				} catch (error) {
					logWithTimestamp(
						`[Uplink Runner] Error terminating session: ${(error as Error).message}`,
					)
				}
			}

			// Then close the transport
			logWithTimestamp(
				"[Uplink Runner] Attempting to close transport (3s timeout)...",
			)
			await Promise.race([
				transport.close(),
				new Promise((_, reject) =>
					setTimeout(
						() =>
							reject(
								new Error("[Uplink Runner] Transport close timeout after 3s"),
							),
						TRANSPORT_CLOSE_TIMEOUT,
					),
				),
			])
			logWithTimestamp("[Uplink Runner] Transport closed successfully")
		} catch (error) {
			logWithTimestamp(
				`[Uplink Runner] Error during transport cleanup: ${(error as Error).message}`,
			)
		}

		logWithTimestamp("[Uplink Runner] Cleanup completed")
		console.log(
			`\n\n${chalk.rgb(
				234,
				88,
				12,
			)(
				"Thanks for using Smithery Uplink!",
			)}\n🚀 One-click cloud deploy: ${chalk.blue.underline(
				"https://smithery.ai/new",
			)}\n\n`,
		)
	}

	process.on("SIGINT", handleExit)
	process.on("SIGTERM", handleExit)
	process.on("beforeExit", handleExit)
	process.on("exit", () => {
		logWithTimestamp("[Uplink Runner] Final cleanup on exit")
	})

	process.stdin.on("end", () => {
		logWithTimestamp("[Uplink Runner] STDIN closed (client disconnected)")
		handleExit().catch((error) => {
			logWithTimestamp(
				`[Uplink Runner] Error during stdin close cleanup: ${error}`,
			)
			process.exit(1)
		})
	})

	process.stdin.on("error", (error) => {
		logWithTimestamp(`[Uplink Runner] STDIN error: ${error.message}`)
		handleExit().catch((error) => {
			logWithTimestamp(
				`[Uplink Runner] Error during stdin error cleanup: ${error}`,
			)
			process.exit(1)
		})
	})

	process.stdin.on("data", (data) =>
		processMessage(data).catch((error) =>
			handleError(error, "[Uplink Runner] Error processing message"),
		),
	)

	await setupTransport()

	return cleanup
}
