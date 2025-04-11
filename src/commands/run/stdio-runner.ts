import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import {
	type CallToolRequest,
	type JSONRPCError,
	type JSONRPCMessage,
	CallToolRequestSchema,
	ErrorCode,
} from "@modelcontextprotocol/sdk/types.js"
import fetch from "cross-fetch"
import { pick } from "lodash"
import { ANALYTICS_ENDPOINT } from "../../constants"
import { verbose } from "../../logger"
import { fetchConnection } from "../../registry"
import type { RegistryServer } from "../../types/registry"
import { formatConfigValues } from "../../utils/config"
import { getRuntimeEnvironment } from "../../utils/runtime"
import { handleTransportError } from "./runner-utils.js"

type Config = Record<string, unknown>
type Cleanup = () => Promise<void>

export const createStdioRunner = async (
	serverDetails: RegistryServer,
	config: Config,
	apiKey: string | undefined,
	analyticsEnabled: boolean,
): Promise<Cleanup> => {
	let stdinBuffer = ""
	let isReady = false
	let isShuttingDown = false
	let transport: StdioClientTransport | null = null

	const handleError = (error: Error, context: string) => {
		console.error(`[Runner] ${context}:`, error.message)
		return error
	}

	const processMessage = async (data: Buffer) => {
		stdinBuffer += data.toString("utf8")

		if (!isReady) return // Wait for connection to be established

		const lines = stdinBuffer.split(/\r?\n/)
		stdinBuffer = lines.pop() ?? ""

		for (const line of lines.filter(Boolean)) {
			try {
				const message = JSON.parse(line) as JSONRPCMessage

				// Track tool usage if user consent is given
				if (analyticsEnabled && apiKey && ANALYTICS_ENDPOINT) {
					const { data: toolData, error } = CallToolRequestSchema.safeParse(
						message,
					) as {
						data: CallToolRequest | undefined
						error: Error | null
					}

					if (!error) {
						// Fire and forget analytics
						fetch(ANALYTICS_ENDPOINT, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${apiKey}`,
							},
							body: JSON.stringify({
								eventName: "tool_call",
								payload: {
									connectionType: "stdio",
									serverQualifiedName: serverDetails.qualifiedName,
									toolParams: toolData ? pick(toolData.params, "name") : {},
								},
							}),
						}).catch((err: Error) => {
							console.error("[Runner] Analytics error:", err)
						})
					}
				}

				await transport?.send(message)
			} catch (error) {
				handleError(error as Error, "Failed to send message to child process")
			}
		}
	}

	const setupTransport = async () => {
		console.error("[Runner] Starting child process setup...")
		const stdioConnection = serverDetails.connections.find(
			(conn) => conn.type === "stdio",
		)
		if (!stdioConnection) {
			throw new Error("No STDIO connection found")
		}

		// Process config values and fetch server configuration
		const processedConfig = await formatConfigValues(stdioConnection, config)
		const serverConfig = await fetchConnection(
			serverDetails.qualifiedName,
			processedConfig,
		)

		if (!serverConfig || "type" in serverConfig) {
			throw new Error("Failed to get valid stdio server configuration")
		}

		const { command, args = [], env = {} } = serverConfig

		// Use runtime environment with proper PATH setup
		const runtimeEnv = getRuntimeEnvironment(env)

		// Log the environment variables being used
		verbose(
			`[Runner] Using environment: ${JSON.stringify(runtimeEnv, null, 2)}`,
		)

		let finalCommand = command
		let finalArgs = args

		// Resolve npx path upfront if needed
		if (finalCommand === "npx") {
			console.error("[Runner] Using npx path:", finalCommand)

			// Special handling for Windows platform
			if (process.platform === "win32") {
				console.error(
					"[Runner] Windows platform detected, using cmd /c for npx",
				)
				finalArgs = ["/c", "npx", ...finalArgs]
				finalCommand = "cmd"
			}
		}

		console.error("[Runner] Executing:", {
			command: finalCommand,
			args: finalArgs,
		})

		try {
			transport = new StdioClientTransport({
				command: finalCommand,
				args: finalArgs,
				env: runtimeEnv,
			})
		} catch (error) {
			console.error("For more help, see: https://smithery.ai/docs/faq/users")
			throw error
		}

		transport.onmessage = (message: JSONRPCMessage) => {
			try {
				if ("error" in message && message.error) {
					const errorMessage = message as JSONRPCError
					handleTransportError(errorMessage)
					// For connection closed error, trigger cleanup
					if (errorMessage.error.code === ErrorCode.ConnectionClosed) {
						handleExit().catch((error) => {
							console.error("[Runner] Error during exit cleanup:", error)
							process.exit(1)
						})
					}
				}
				// Forward the message to stdout
				console.log(JSON.stringify(message))
			} catch (error) {
				handleError(error as Error, "Error handling message")
				handleExit().catch((error) => {
					console.error("[Runner] Error during exit cleanup:", error)
					process.exit(1)
				})
			}
		}

		transport.onclose = () => {
			console.error("[Runner] Child process terminated")
			// Only treat it as unexpected if we're ready and haven't started cleanup
			if (isReady && !isShuttingDown) {
				console.error("[Runner] Process terminated unexpectedly while running")
				handleExit().catch((error) => {
					console.error("[Runner] Error during exit cleanup:", error)
					process.exit(1)
				})
			}
		}

		transport.onerror = (err) => {
			console.error("[Runner] Child process error:", err.message)
			if (err.message.includes("spawn")) {
				console.error(
					"[Runner] Failed to spawn child process - check if the command exists and is executable",
				)
			} else if (err.message.includes("permission")) {
				console.error("[Runner] Permission error when running child process")
			}
			handleExit().catch((error) => {
				console.error("[Runner] Error during error cleanup:", error)
				process.exit(1)
			})
		}

		await transport.start()
		isReady = true
		// Process any buffered messages
		await processMessage(Buffer.from(""))
	}

	const cleanup = async () => {
		// Prevent recursive cleanup calls
		if (isShuttingDown) {
			console.error("[Runner] Cleanup already in progress, skipping...")
			return
		}

		console.error("[Runner] Starting cleanup...")
		isShuttingDown = true

		// Close transport gracefully
		if (transport) {
			try {
				console.error("[Runner] Attempting to close transport...")
				await Promise.race([
					transport.close(),
					new Promise((_, reject) =>
						setTimeout(
							() => reject(new Error("Transport close timeout")),
							3000,
						),
					),
				])
				console.error("[Runner] Transport closed successfully")
			} catch (error) {
				console.error("[Runner] Error during transport cleanup:", error)
			}
			transport = null
		}

		console.error("[Runner] Cleanup completed")
	}

	const handleExit = async () => {
		console.error("[Runner] Exit handler triggered, starting shutdown...")
		await cleanup()
		if (!isShuttingDown) {
			process.exit(0)
		}
	}

	// Setup event handlers
	process.on("SIGINT", handleExit)
	process.on("SIGTERM", handleExit)
	process.on("beforeExit", handleExit)
	process.on("exit", () => {
		// Synchronous cleanup for exit event
		console.error("[Runner] Final cleanup on exit")
	})

	// Handle STDIN closure (client disconnect)
	process.stdin.on("end", () => {
		console.error("[Runner] STDIN closed (client disconnected)")
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
			handleError(error, "Error processing message"),
		),
	)

	// Start the transport
	await setupTransport()

	return cleanup
}
