import type { ResolvedServer } from "../types/registry.js"
import { collectConfigValues } from "../utils/runtime-utils.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js"
import { getServerConfiguration } from "../utils/registry-utils.js"
import { ANALYTICS_ENDPOINT } from "../constants.js"
import {
	type JSONRPCMessage,
	CallToolRequestSchema,
	type CallToolRequest,
	type JSONRPCError,
	ErrorCode,
} from "@modelcontextprotocol/sdk/types.js"
import { pick } from "lodash"

type Config = Record<string, unknown>
type Cleanup = () => Promise<void>

export const createStdioRunner = async (
	serverDetails: ResolvedServer,
	config: Config,
	userId?: string,
): Promise<Cleanup> => {
	let stdinBuffer = ""
	let isReady = false
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
				if (userId && ANALYTICS_ENDPOINT) {
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
		const processedConfig = await collectConfigValues(stdioConnection, config)
		const serverConfig = await getServerConfiguration(
			serverDetails.qualifiedName,
			processedConfig,
			"stdio",
		)

		if (!serverConfig || "type" in serverConfig) {
			throw new Error("Failed to get valid stdio server configuration")
		}

		const { command, args = [], env = {} } = serverConfig

		// Windows-specific path resolution
		let finalCommand = command
		let finalArgs = args

		if (process.platform === 'win32') {
			try {
				// Use path.isAbsolute() to check if it's a full path
				const path = require('path')
				if (!path.isAbsolute(command)) {
					const { execSync } = require('child_process')
					finalCommand = execSync(`where ${command}`, { encoding: 'utf8' }).split('\n')[0].trim()
				}

				// Handle spaces in paths on Windows by using process.execPath (node.exe)
				if (finalCommand.includes(' ')) {
					finalArgs = [finalCommand, ...args]
					finalCommand = process.execPath
				}
			} catch (error) {
				console.error('[Runner] Could not resolve full path for command:', command, error)
				// Fallback to original command
				finalCommand = command
				finalArgs = args
			}
		}

		console.error('[Runner] Executing:', { command: finalCommand, args: finalArgs })

		transport = new StdioClientTransport({
			command: finalCommand,
			args: finalArgs,
			env: { ...getDefaultEnvironment(), ...env },
		})

		transport.onmessage = (message: JSONRPCMessage) => {
			try {
				if ("error" in message) {
					const errorMessage = message as JSONRPCError
					// Skip logging "Method not found" errors, let the client handle this
					if (errorMessage.error?.code !== ErrorCode.MethodNotFound) {
						console.error(`[Runner] Child process error:`, errorMessage.error)
					}
				}
				// Forward the message to stdout
				console.log(JSON.stringify(message))
			} catch (error) {
				handleError(error as Error, "Error handling message")
			}
		}

		transport.onclose = () => {
			console.error("[Runner] Child process terminated")
			// If the process died unexpectedly, we should exit with an error
			if (isReady) {
				console.error("[Runner] Process terminated unexpectedly while running")
				process.exit(1)
			}
			process.exit(0)
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
			process.exit(1)
		}

		await transport.start()
		isReady = true
		// Process any buffered messages
		await processMessage(Buffer.from(""))
	}

	const cleanup = async () => {
		console.error("[Runner] Starting cleanup...")
		if (transport) {
			await transport.close()
			transport = null
		}
		console.error("[Runner] Cleanup completed")
	}

	const handleExit = async () => {
		console.error("[Runner] Shutting down STDIO Runner...")
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
