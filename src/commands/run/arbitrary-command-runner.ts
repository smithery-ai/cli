import { type ChildProcess, spawn } from "node:child_process"
import type {
	JSONRPCError,
	JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js"
import chalk from "chalk"
import cors from "cors"
import express from "express"
import { setupTunnelAndPlayground } from "../../lib/dev-lifecycle.js"
import { handleTransportError, logWithTimestamp } from "./utils.js"

interface ArbitraryCommandOptions {
	open?: boolean
	initialMessage?: string
	port?: number
}

type Cleanup = () => Promise<void>

export const createArbitraryCommandRunner = async (
	command: string,
	apiKey: string,
	options: ArbitraryCommandOptions = {},
): Promise<Cleanup> => {
	let isShuttingDown = false
	let isReady = false
	let childProcess: ChildProcess | null = null
	let httpServer: any = null
	let tunnelListener: { close: () => Promise<void> } | undefined
	const pendingRequests = new Map<
		string,
		{ resolve: (value: JSONRPCMessage) => void; reject: (reason?: any) => void }
	>()

	const localPort = options.port || 6969
	const app = express()

	// Enable CORS and JSON parsing
	app.use(cors())
	app.use(express.json())

	const handleError = (error: Error, context: string) => {
		logWithTimestamp(`[stdio listener] ${context}: ${error.message}`)
		return error
	}

	const handleExit = async () => {
		logWithTimestamp(
			"[stdio listener] Received exit signal, initiating shutdown...",
		)
		await cleanup()
		process.exit(0)
	}

	// HTTP endpoint to receive RPC messages
	app.post("/mcp", async (req: express.Request, res: express.Response) => {
		try {
			if (!isReady || !childProcess || childProcess.killed) {
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
				`[stdio listener] Received HTTP request: ${JSON.stringify(message)}`,
			)

			// For requests with IDs, we need to wait for responses
			if ("id" in message && message.id !== null && message.id !== undefined) {
				const messageId = String(message.id)

				// Send the message to the child process via stdin
				const messageStr = `${JSON.stringify(message)}\n`
				childProcess.stdin?.write(messageStr)

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
				const messageStr = `${JSON.stringify(message)}\n`
				childProcess.stdin?.write(messageStr)
				res.status(200).json({ success: true })
			}
		} catch (error) {
			logWithTimestamp(`[stdio listener] Error handling HTTP request: ${error}`)
			res.status(500).json({
				error: error instanceof Error ? error.message : "Internal server error",
				code: -32603,
			})
		}
	})

	// Health check endpoint
	app.get("/health", (_req: express.Request, res: express.Response) => {
		res.json({
			status: isReady ? "ready" : "not ready",
			uptime: process.uptime(),
		})
	})

	const setupCommandProcess = async () => {
		logWithTimestamp("[stdio listener] Starting command process setup...")

		const [cmd, ...args] = command.split(" ")

		logWithTimestamp(
			`[stdio listener] Executing command: ${JSON.stringify({
				command: cmd,
				args: args,
			})}`,
		)

		try {
			childProcess = spawn(cmd, args, {
				stdio: ["pipe", "pipe", "pipe"],
				env: {
					...process.env,
				},
			})
		} catch (error) {
			logWithTimestamp(
				"[stdio listener] For more help, see: https://smithery.ai/docs/faq/users",
			)
			throw error
		}

		// Handle stdout - parse JSON-RPC messages
		childProcess.stdout?.on("data", (data: Buffer) => {
			try {
				const chunk = data.toString()
				const lines = chunk.split("\n").filter((line) => line.trim())

				for (const line of lines) {
					try {
						const message = JSON.parse(line) as JSONRPCMessage

						logWithTimestamp(
							`[stdio listener] Received stdout message: ${JSON.stringify(message)}`,
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
								continue
							}
						}

						// For other messages (notifications, etc.), log them
						logWithTimestamp(
							`[stdio listener] Command output: ${JSON.stringify(message)}`,
						)
					} catch (_parseError) {
						// If it's not valid JSON-RPC, just log the raw output
						logWithTimestamp(`[stdio listener] Raw stdout: ${line}`)
					}
				}
			} catch (error) {
				handleError(error as Error, "Error handling stdout")
			}
		})

		// Handle stderr
		childProcess.stderr?.on("data", (data: Buffer) => {
			const chunk = data.toString()
			logWithTimestamp(`[stdio listener] stderr: ${chunk}`)
		})

		childProcess.on("close", (code) => {
			logWithTimestamp(`[stdio listener] Process terminated with code ${code}`)
			if (isReady && !isShuttingDown) {
				logWithTimestamp("[stdio listener] Process terminated unexpectedly")
				handleExit().catch((error) => {
					logWithTimestamp(
						`[stdio listener] Error during exit cleanup: ${error}`,
					)
					process.exit(1)
				})
			}
		})

		childProcess.on("error", (err) => {
			logWithTimestamp(`[stdio listener] Process error: ${err.message}`)
		})

		// Give the process a moment to start up
		await new Promise((resolve) => setTimeout(resolve, 1000))

		isReady = true
		logWithTimestamp("[stdio listener] Command process established")
	}

	const startHttpServer = async () => {
		return new Promise<void>((resolve, reject) => {
			httpServer = app.listen(localPort, (err?: Error) => {
				if (err) {
					reject(err)
				} else {
					logWithTimestamp(
						`[stdio listener] HTTP server listening on port ${localPort}`,
					)
					resolve()
				}
			})
		})
	}

	const cleanup = async () => {
		if (isShuttingDown) {
			logWithTimestamp(
				"[stdio listener] Cleanup already in progress, skipping...",
			)
			return
		}

		logWithTimestamp("[stdio listener] Starting cleanup process...")
		isShuttingDown = true

		// Reject all pending requests
		for (const [_id, { reject }] of pendingRequests) {
			reject(new Error("Server shutting down"))
		}
		pendingRequests.clear()

		// Close tunnel first
		if (tunnelListener) {
			try {
				logWithTimestamp("[stdio listener] Closing tunnel...")
				await tunnelListener.close()
				logWithTimestamp("[stdio listener] Tunnel closed successfully")
			} catch (error) {
				logWithTimestamp(`[stdio listener] Error closing tunnel: ${error}`)
			}
		}

		// Close HTTP server
		if (httpServer) {
			try {
				logWithTimestamp("[stdio listener] Closing HTTP server...")
				await new Promise<void>((resolve) => {
					httpServer.close(() => {
						logWithTimestamp("[stdio listener] HTTP server closed")
						resolve()
					})
				})
			} catch (error) {
				logWithTimestamp(`[stdio listener] Error closing HTTP server: ${error}`)
			}
		}

		// Close child process
		if (childProcess && !childProcess.killed) {
			try {
				logWithTimestamp("[stdio listener] Terminating child process...")

				// Wait for process to exit after sending SIGTERM
				const processExited = new Promise<void>((resolve) => {
					if (childProcess) {
						childProcess.on("exit", () => resolve())
					} else {
						resolve()
					}
				})

				childProcess.kill("SIGTERM")

				// Race between graceful exit and force kill
				const forceKill = new Promise<void>((resolve) => {
					setTimeout(() => {
						if (childProcess && !childProcess.killed) {
							childProcess.kill("SIGKILL")
						}
						resolve()
					}, 3000)
				})

				// Wait for either graceful exit or force kill timeout
				await Promise.race([processExited, forceKill])

				logWithTimestamp(
					"[stdio listener] Child process terminated successfully",
				)
			} catch (error) {
				logWithTimestamp(
					`[stdio listener] Error terminating child process: ${error}`,
				)
			}
			childProcess = null
		}

		logWithTimestamp("[stdio listener] Cleanup completed")
		console.log(
			`\n\n${chalk.rgb(
				234,
				88,
				12,
			)("Thanks for using Smithery stdio listener!")}\n🚀

			Feedback/Bug Reports: ${chalk.blue.underline(
				"https://github.com/smithery-ai/cli/issues/new",
			)}\n\n`,
		)
	}

	// Setup signal handlers
	process.on("SIGINT", handleExit)
	process.on("SIGTERM", handleExit)
	process.on("beforeExit", handleExit)
	process.on("exit", () => {
		logWithTimestamp("[stdio listener] Final cleanup on exit")
	})

	try {
		// Start HTTP server first
		await startHttpServer()

		// Then setup command process
		await setupCommandProcess()

		// Finally setup tunnel and playground
		console.log(
			chalk.green("✅ Command server started, setting up uplink tunnel..."),
		)
		const { listener } = await setupTunnelAndPlayground(
			String(localPort),
			apiKey,
			options.open !== false,
		)
		tunnelListener = listener
		console.log(
			chalk.green("🚀 Command uplink tunnel established and playground opened"),
		)
	} catch (error) {
		logWithTimestamp(`[stdio listener] Failed to start: ${error}`)
		await cleanup()
		throw error
	}

	return cleanup
}
