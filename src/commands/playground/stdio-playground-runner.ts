import { type ChildProcess, spawn } from "node:child_process"
import type { Server } from "node:http"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import type {
	JSONRPCErrorResponse,
	JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js"
import chalk from "chalk"
import cors from "cors"
import express from "express"
import { TRANSPORT_CLOSE_TIMEOUT } from "../../constants.js"
import { setupTunnelAndPlayground } from "../../lib/dev-lifecycle.js"
import { getRuntimeEnvironment } from "../../utils/runtime.js"
import { handleTransportError, logWithTimestamp } from "../run/utils.js"

interface PlaygroundOptions {
	open?: boolean
	initialMessage?: string
	port?: number
}

type Cleanup = () => Promise<void>

interface PreprocessedInput {
	command: string
	args: string[]
	env: Record<string, string>
	qualifiedName?: string
}

interface RawCommandInput {
	rawCommand: string
}

type PlaygroundRunnerInput = PreprocessedInput | RawCommandInput

function isPreprocessedInput(
	input: PlaygroundRunnerInput,
): input is PreprocessedInput {
	return "command" in input && "args" in input && "env" in input
}

export const createStdioPlaygroundRunner = async (
	input: PlaygroundRunnerInput,
	apiKey: string,
	options: PlaygroundOptions = {},
): Promise<Cleanup> => {
	let isShuttingDown = false
	let isReady = false
	let transport: StdioClientTransport | null = null
	let childProcess: ChildProcess | null = null
	let httpServer: Server | null = null
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
	const useMcpTransport = isPreprocessedInput(input)

	// Enable CORS and JSON parsing
	app.use(cors())
	app.use(express.json())

	const handleError = (error: Error, context: string) => {
		const prefix = useMcpTransport ? "[Playground]" : "[Playground]"
		logWithTimestamp(`${prefix} ${context}: ${error.message}`)
		return error
	}

	const handleExit = async () => {
		logWithTimestamp(
			"[Playground] Received exit signal, initiating shutdown...",
		)
		await cleanup()
		process.exit(0)
	}

	// HTTP endpoint to receive RPC messages
	app.post("/mcp", async (req: express.Request, res: express.Response) => {
		try {
			if (useMcpTransport) {
				if (!isReady || !transport) {
					res.status(503).json({
						error: "Server not ready",
						code: -32603,
					})
					return
				}
			} else {
				if (!isReady || !childProcess || childProcess.killed) {
					res.status(503).json({
						error: "Server not ready",
						code: -32603,
					})
					return
				}
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
				`[Playground] Received HTTP request: ${JSON.stringify(message)}`,
			)

			// For requests with IDs, we need to wait for responses
			if ("id" in message && message.id !== null && message.id !== undefined) {
				const messageId = String(message.id)

				// Send the message to the STDIO process
				if (useMcpTransport && transport) {
					await transport.send(message)
				} else if (!useMcpTransport && childProcess) {
					const messageStr = `${JSON.stringify(message)}\n`
					childProcess.stdin?.write(messageStr)
				}

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
				if (useMcpTransport && transport) {
					await transport.send(message)
				} else if (!useMcpTransport && childProcess) {
					const messageStr = `${JSON.stringify(message)}\n`
					childProcess.stdin?.write(messageStr)
				}
				res.status(200).json({ success: true })
			}
		} catch (error) {
			logWithTimestamp(`[Playground] Error handling HTTP request: ${error}`)
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

	const setupStdioTransport = async () => {
		if (useMcpTransport) {
			// Use MCP SDK transport for pre-processed input
			logWithTimestamp("[Playground] Starting STDIO process setup...")

			const runtimeEnv = getRuntimeEnvironment(input.env)

			let finalCommand = input.command
			let finalArgs = input.args

			// Handle Windows platform for npx
			if (finalCommand === "npx" && process.platform === "win32") {
				logWithTimestamp(
					"[Playground] Windows platform detected, using cmd /c for npx",
				)
				finalArgs = ["/c", "npx", ...finalArgs]
				finalCommand = "cmd"
			}

			logWithTimestamp(
				`[Playground] Executing STDIO process: ${JSON.stringify({
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
				logWithTimestamp(
					"For more help, see: https://smithery.ai/docs/faq/users",
				)
				throw error
			}

			transport.onmessage = (message: JSONRPCMessage) => {
				try {
					logWithTimestamp(
						`[Playground] Received STDIO message: ${JSON.stringify(message)}`,
					)

					if ("error" in message && message.error) {
						const errorMessage = message as JSONRPCErrorResponse
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
						`[Playground] STDIO output: ${JSON.stringify(message)}`,
					)
				} catch (error) {
					handleError(error as Error, "Error handling STDIO message")
				}
			}

			transport.onclose = () => {
				logWithTimestamp("[Playground] STDIO process terminated")
				if (isReady && !isShuttingDown) {
					logWithTimestamp("[Playground] Process terminated unexpectedly")
					handleExit().catch((error) => {
						logWithTimestamp(`[Playground] Error during exit cleanup: ${error}`)
						process.exit(1)
					})
				}
			}

			transport.onerror = (err) => {
				logWithTimestamp(`[Playground] STDIO process error: ${err.message}`)
			}

			await transport.start()
			isReady = true
			logWithTimestamp("[Playground] STDIO transport established")
		} else {
			// Use raw spawn for raw command input
			logWithTimestamp("[Playground] Starting command process setup...")

			const [cmd, ...args] = input.rawCommand.split(" ")

			logWithTimestamp(
				`[Playground] Executing command: ${JSON.stringify({
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
					"[Playground] For more help, see: https://smithery.ai/docs/faq/users",
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
								`[Playground] Received stdout message: ${JSON.stringify(message)}`,
							)

							if ("error" in message && message.error) {
								const errorMessage = message as JSONRPCErrorResponse
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
								`[Playground] Command output: ${JSON.stringify(message)}`,
							)
						} catch (_parseError) {
							// If it's not valid JSON-RPC, just log the raw output
							logWithTimestamp(`[Playground] Raw stdout: ${line}`)
						}
					}
				} catch (error) {
					handleError(error as Error, "Error handling stdout")
				}
			})

			// Handle stderr
			childProcess.stderr?.on("data", (data: Buffer) => {
				const chunk = data.toString()
				logWithTimestamp(`[Playground] stderr: ${chunk}`)
			})

			childProcess.on("close", (code) => {
				logWithTimestamp(`[Playground] Process terminated with code ${code}`)
				if (isReady && !isShuttingDown) {
					logWithTimestamp("[Playground] Process terminated unexpectedly")
					handleExit().catch((error) => {
						logWithTimestamp(`[Playground] Error during exit cleanup: ${error}`)
						process.exit(1)
					})
				}
			})

			childProcess.on("error", (err) => {
				logWithTimestamp(`[Playground] Process error: ${err.message}`)
			})

			// Give the process a moment to start up
			await new Promise((resolve) => setTimeout(resolve, 1000))

			isReady = true
			logWithTimestamp("[Playground] Command process established")
		}
	}

	const startHttpServer = async () => {
		return new Promise<void>((resolve, reject) => {
			httpServer = app.listen(localPort, (err?: Error) => {
				if (err) {
					reject(err)
				} else {
					logWithTimestamp(
						`[Playground] HTTP server listening on port ${localPort}`,
					)
					resolve()
				}
			})
		})
	}

	const cleanup = async () => {
		if (isShuttingDown) {
			logWithTimestamp("[Playground] Cleanup already in progress, skipping...")
			return
		}

		logWithTimestamp("[Playground] Starting cleanup process...")
		isShuttingDown = true

		// Reject all pending requests
		for (const [_id, { reject }] of pendingRequests) {
			reject(new Error("Server shutting down"))
		}
		pendingRequests.clear()

		// Close tunnel first
		if (tunnelListener) {
			try {
				logWithTimestamp("[Playground] Closing tunnel...")
				await tunnelListener.close()
				logWithTimestamp("[Playground] Tunnel closed successfully")
			} catch (error) {
				logWithTimestamp(`[Playground] Error closing tunnel: ${error}`)
			}
		}

		// Close HTTP server
		if (httpServer) {
			try {
				logWithTimestamp("[Playground] Closing HTTP server...")
				await new Promise<void>((resolve) => {
					httpServer!.close(() => {
						logWithTimestamp("[Playground] HTTP server closed")
						resolve()
					})
				})
			} catch (error) {
				logWithTimestamp(`[Playground] Error closing HTTP server: ${error}`)
			}
		}

		// Close STDIO transport or child process
		if (useMcpTransport && transport) {
			try {
				logWithTimestamp("[Playground] Closing STDIO transport...")
				await Promise.race([
					transport.close(),
					new Promise((_, reject) =>
						setTimeout(
							() => reject(new Error("Transport close timeout")),
							TRANSPORT_CLOSE_TIMEOUT,
						),
					),
				])
				logWithTimestamp("[Playground] STDIO transport closed successfully")
			} catch (error) {
				logWithTimestamp(`[Playground] Error closing STDIO transport: ${error}`)
			}
			transport = null
		} else if (!useMcpTransport && childProcess && !childProcess.killed) {
			try {
				logWithTimestamp("[Playground] Terminating child process...")

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

				logWithTimestamp("[Playground] Child process terminated successfully")
			} catch (error) {
				logWithTimestamp(
					`[Playground] Error terminating child process: ${error}`,
				)
			}
			childProcess = null
		}

		logWithTimestamp("[Playground] Cleanup completed")
		console.log(
			`\n\n${chalk.rgb(
				234,
				88,
				12,
			)(
				"Thanks for using Smithery Local Playground!",
			)}\n${chalk.blue("^ One-click cloud deploy: https://smithery.ai/new")}\n\n`,
		)
	}

	// Setup signal handlers
	process.on("SIGINT", handleExit)
	process.on("SIGTERM", handleExit)
	process.on("beforeExit", handleExit)
	process.on("exit", () => {
		logWithTimestamp("[Playground] Final cleanup on exit")
	})

	try {
		// Start HTTP server first
		await startHttpServer()

		// Then setup STDIO transport
		await setupStdioTransport()

		// Finally setup tunnel and playground
		console.log(
			chalk.green("✓ Local server started, setting up uplink tunnel..."),
		)
		const { listener } = await setupTunnelAndPlayground(
			String(localPort),
			apiKey,
			options.open !== false,
		)
		tunnelListener = listener
		console.log(
			chalk.green("* Local uplink tunnel established and playground opened"),
		)
	} catch (error) {
		logWithTimestamp(`[Playground] Failed to start: ${error}`)
		await cleanup()
		throw error
	}

	return cleanup
}
