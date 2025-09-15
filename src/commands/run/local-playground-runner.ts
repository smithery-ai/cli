import chalk from "chalk"
import express from "express"
import cors from "cors"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import type {
	JSONRPCMessage,
	JSONRPCError,
} from "@modelcontextprotocol/sdk/types.js"
import { setupTunnelAndPlayground } from "../../lib/dev-lifecycle.js"
import { fetchConnection } from "../../lib/registry.js"
import { getRuntimeEnvironment } from "../../utils/runtime.js"
import { TRANSPORT_CLOSE_TIMEOUT } from "../../constants.js"
import {
	logWithTimestamp,
	handleTransportError,
	createIdleTimeoutManager,
	createHeartbeatManager,
} from "./runner-utils.js"
import type { ServerDetailResponse } from "@smithery/registry/models/components"
import type { ServerConfig } from "../../types/registry.js"

interface LocalPlaygroundOptions {
	open?: boolean
	initialMessage?: string
	port?: number
}

type Cleanup = () => Promise<void>

export const createLocalPlaygroundRunner = async (
	serverDetails: ServerDetailResponse,
	config: ServerConfig,
	apiKey: string,
	options: LocalPlaygroundOptions = {},
): Promise<Cleanup> => {
	let isShuttingDown = false
	let isReady = false
	let transport: StdioClientTransport | null = null
	let httpServer: any = null
	let tunnelListener: { close: () => Promise<void> } | undefined
	const pendingRequests = new Map<
		string,
		{
			resolve: (value: JSONRPCMessage) => void
			reject: (reason: Error) => void
		}
	>()

	const localPort = options.port || 6969
	const app = express()

	// Enable CORS and JSON parsing
	app.use(cors())
	app.use(express.json())

	const handleError = (error: Error, context: string) => {
		logWithTimestamp(`[Local Playground] ${context}: ${error.message}`)
		return error
	}

	const handleExit = async () => {
		logWithTimestamp(
			"[Local Playground] Received exit signal, initiating shutdown...",
		)
		await cleanup()
		if (!isShuttingDown) {
			process.exit(0)
		}
	}

	const idleManager = createIdleTimeoutManager(handleExit)
	const heartbeatManager = createHeartbeatManager(
		async (message) => {
			if (transport) {
				await transport.send(message)
			}
		},
		() => isReady,
	)

	// HTTP endpoint to receive RPC messages
	app.post("/mcp", async (req: express.Request, res: express.Response) => {
		try {
			idleManager.updateActivity()

			if (!isReady || !transport) {
				res.status(503).json({
					error: "Server not ready",
					code: -32603,
				})
				return
			}

			const message = req.body as JSONRPCMessage

			if (!message) {
				res.status(400).json({
					error: "Invalid JSON-RPC message",
					code: -32600,
				})
				return
			}

			logWithTimestamp(
				`[Local Playground] Received HTTP request: ${JSON.stringify(message)}`,
			)

			// For requests with IDs, we need to wait for responses
			if ("id" in message && message.id !== null && message.id !== undefined) {
				const messageId = String(message.id)

				// Send the message to the STDIO process
				await transport.send(message)

				// Wait for response with timeout
				const response = await new Promise<JSONRPCMessage>(
					(resolve, reject) => {
						pendingRequests.set(messageId, { resolve, reject })

						// Timeout after 30 seconds
						setTimeout(() => {
							if (pendingRequests.has(messageId)) {
								pendingRequests.delete(messageId)
								reject(new Error("Request timeout"))
							}
						}, 30000)
					},
				)

				res.json(response)
			} else {
				// For notifications (no ID), just send and respond immediately
				await transport.send(message)
				res.status(200).json({ success: true })
			}
		} catch (error) {
			logWithTimestamp(
				`[Local Playground] Error handling HTTP request: ${error}`,
			)
			res.status(500).json({
				error: error instanceof Error ? error.message : "Internal server error",
				code: -32603,
			})
		}
	})

	// Health check endpoint
	app.get("/health", (req: express.Request, res: express.Response) => {
		res.json({
			status: isReady ? "ready" : "not ready",
			uptime: process.uptime(),
		})
	})

	const setupStdioTransport = async () => {
		logWithTimestamp("[Local Playground] Starting STDIO process setup...")

		const stdioConnection = serverDetails.connections.find(
			(conn) => conn.type === "stdio",
		)
		if (!stdioConnection) {
			throw new Error("No STDIO connection found")
		}

		// Process config values and fetch server configuration
		const serverConfig = await fetchConnection(
			serverDetails.qualifiedName,
			config,
			apiKey,
		)

		if (!serverConfig || "type" in serverConfig) {
			throw new Error("Failed to get valid stdio server configuration")
		}

		const { command, args = [], env = {} } = serverConfig
		const runtimeEnv = getRuntimeEnvironment(env)

		let finalCommand = command
		let finalArgs = args

		// Handle Windows platform for npx
		if (finalCommand === "npx" && process.platform === "win32") {
			logWithTimestamp(
				"[Local Playground] Windows platform detected, using cmd /c for npx",
			)
			finalArgs = ["/c", "npx", ...finalArgs]
			finalCommand = "cmd"
		}

		logWithTimestamp(
			`[Local Playground] Executing STDIO process: ${JSON.stringify({
				command: finalCommand,
				args: finalArgs,
			})}`,
		)

		try {
			transport = new StdioClientTransport({
				command: finalCommand,
				args: finalArgs,
				env: runtimeEnv,
			})
		} catch (error) {
			logWithTimestamp("For more help, see: https://smithery.ai/docs/faq/users")
			throw error
		}

		transport.onmessage = (message: JSONRPCMessage) => {
			try {
				// Only update activity for non-heartbeat messages
				if (
					"method" in message &&
					!(message.method === "ping" || message.method === "pong")
				) {
					idleManager.updateActivity()
				}

				logWithTimestamp(
					`[Local Playground] Received STDIO message: ${JSON.stringify(message)}`,
				)

				if ("error" in message && message.error) {
					const errorMessage = message as JSONRPCError
					handleTransportError(errorMessage)
				}

				// Handle responses to pending HTTP requests
				if (
					"id" in message &&
					message.id !== null &&
					message.id !== undefined
				) {
					const messageId = String(message.id)
					const pending = pendingRequests.get(messageId)
					if (pending) {
						pendingRequests.delete(messageId)
						pending.resolve(message)
						return
					}
				}

				// For other messages (notifications, etc.), log them
				logWithTimestamp(
					`[Local Playground] STDIO output: ${JSON.stringify(message)}`,
				)
			} catch (error) {
				handleError(error as Error, "Error handling STDIO message")
			}
		}

		transport.onclose = () => {
			logWithTimestamp("[Local Playground] STDIO process terminated")
			if (isReady && !isShuttingDown) {
				logWithTimestamp("[Local Playground] Process terminated unexpectedly")
				handleExit().catch((error) => {
					logWithTimestamp(
						`[Local Playground] Error during exit cleanup: ${error}`,
					)
					process.exit(1)
				})
			}
		}

		transport.onerror = (err) => {
			logWithTimestamp(`[Local Playground] STDIO process error: ${err.message}`)
		}

		await transport.start()
		isReady = true
		logWithTimestamp("[Local Playground] STDIO transport established")

		heartbeatManager.start()
		idleManager.start()
	}

	const startHttpServer = async () => {
		return new Promise<void>((resolve, reject) => {
			httpServer = app.listen(localPort, (err?: Error) => {
				if (err) {
					reject(err)
				} else {
					logWithTimestamp(
						`[Local Playground] HTTP server listening on port ${localPort}`,
					)
					resolve()
				}
			})
		})
	}

	const cleanup = async () => {
		if (isShuttingDown) {
			logWithTimestamp(
				"[Local Playground] Cleanup already in progress, skipping...",
			)
			return
		}

		logWithTimestamp("[Local Playground] Starting cleanup process...")
		isShuttingDown = true
		heartbeatManager.stop()
		idleManager.stop()

		// Reject all pending requests
		for (const [id, { reject }] of pendingRequests) {
			reject(new Error("Server shutting down"))
		}
		pendingRequests.clear()

		// Close tunnel first
		if (tunnelListener) {
			try {
				logWithTimestamp("[Local Playground] Closing tunnel...")
				await tunnelListener.close()
				logWithTimestamp("[Local Playground] Tunnel closed successfully")
			} catch (error) {
				logWithTimestamp(`[Local Playground] Error closing tunnel: ${error}`)
			}
		}

		// Close HTTP server
		if (httpServer) {
			try {
				logWithTimestamp("[Local Playground] Closing HTTP server...")
				await new Promise<void>((resolve) => {
					httpServer.close(() => {
						logWithTimestamp("[Local Playground] HTTP server closed")
						resolve()
					})
				})
			} catch (error) {
				logWithTimestamp(
					`[Local Playground] Error closing HTTP server: ${error}`,
				)
			}
		}

		// Close STDIO transport
		if (transport) {
			try {
				logWithTimestamp("[Local Playground] Closing STDIO transport...")
				await Promise.race([
					transport.close(),
					new Promise((_, reject) =>
						setTimeout(
							() => reject(new Error("Transport close timeout")),
							TRANSPORT_CLOSE_TIMEOUT,
						),
					),
				])
				logWithTimestamp(
					"[Local Playground] STDIO transport closed successfully",
				)
			} catch (error) {
				logWithTimestamp(
					`[Local Playground] Error closing STDIO transport: ${error}`,
				)
			}
			transport = null
		}

		logWithTimestamp("[Local Playground] Cleanup completed")
		console.log(
			`\n\n${chalk.rgb(
				234,
				88,
				12,
			)(
				"Thanks for using Smithery Local Playground!",
			)}\n🚀 One-click cloud deploy: ${chalk.blue.underline(
				"https://smithery.ai/new",
			)}\n\n`,
		)
	}

	// Setup signal handlers
	process.on("SIGINT", handleExit)
	process.on("SIGTERM", handleExit)
	process.on("beforeExit", handleExit)
	process.on("exit", () => {
		logWithTimestamp("[Local Playground] Final cleanup on exit")
	})

	try {
		// Start HTTP server first
		await startHttpServer()

		// Then setup STDIO transport
		await setupStdioTransport()

		// Finally setup tunnel and playground
		console.log(
			chalk.green("✅ Local server started, setting up uplink tunnel..."),
		)
		const { listener } = await setupTunnelAndPlayground(
			String(localPort),
			apiKey,
			options.open !== false,
			options.initialMessage || "Say hello to the world!",
		)
		tunnelListener = listener
		console.log(
			chalk.green("🚀 Local uplink tunnel established and playground opened"),
		)
	} catch (error) {
		logWithTimestamp(`[Local Playground] Failed to start: ${error}`)
		await cleanup()
		throw error
	}

	return cleanup
}
