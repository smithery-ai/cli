import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import {
	StdioClientTransport,
	getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from "@modelcontextprotocol/sdk/shared/protocol.js"
import {
	CallToolRequestSchema,
	type JSONRPCMessage,
	type ClientRequest,
	type ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js"
import { createSmitheryUrl } from "@smithery/sdk/config.js"
import type { z } from "zod"
import { ANALYTICS_ENDPOINT, REGISTRY_ENDPOINT } from "../constants.js"
import type {
	ConfiguredStdioServer,
	ResolvedServer,
} from "../types/registry.js"
import { HandlerManager, type ServerContext } from "../utils/mcp-handlers.js"
import { collectConfigValues } from "../utils/runtime-utils.js"

import { pick } from "lodash"
export class GatewayServer {
	private server!: Server
	private client: Client
	private handlerManager!: HandlerManager
	private closing = false
	private requestTimeout = DEFAULT_REQUEST_TIMEOUT_MSEC
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private baseReconnectDelay = 1000 // 1 second
	private currentConnectionDetails?: {
		serverDetails: ResolvedServer
		config: Record<string, unknown>
	}
	private isReconnecting = false

	constructor() {
		this.closing = false

		this.client = new Client(
			{ name: "smithery-runner", version: "1.0.0" },
			{ capabilities: {} },
		)
	}

	private async makeRequest<T extends z.ZodType>(
		request: ClientRequest,
		schema: T,
	) {
		if (!this.client) {
			throw new Error("Client not connected")
		}

		const abortController = new AbortController()
		const timeoutId = setTimeout(() => {
			abortController.abort("Request timed out")
		}, this.requestTimeout)

		try {
			const response = await this.client.request(request, schema, {
				signal: abortController.signal,
			})
			return response
		} finally {
			clearTimeout(timeoutId)
		}
	}

	private async setupHandlers(Capabilities: ServerCapabilities): Promise<void> {
		const context: ServerContext = {
			server: this.server,
			makeRequest: this.makeRequest.bind(this),
			isReconnecting: this.isReconnecting,
		}

		this.handlerManager = new HandlerManager(context)
		await this.handlerManager.setupHandlers(Capabilities)
	}

	private setupErrorHandling(): void {
		this.server.onerror = (error) => {
			console.error("[Gateway] Server error:", error)
			if (!this.closing) {
				this.cleanup().catch((err) => {
					console.error("[Gateway] Cleanup error during error handling:", err)
				})
			}
		}

		this.client.onerror = async (error) => {
			console.error("[Gateway] SSE client error:", error)
			if (!this.closing) {
				// For SSE connections, attempt reconnection before cleanup
				const reconnected = await this.attemptReconnection()
				if (!reconnected) {
					this.cleanup().catch((err) => {
						console.error("[Gateway] Cleanup error during error handling:", err)
					})
				}
			}
		}

		this.server.onclose = () => {
			console.error("[Gateway] Server closed")
			if (!this.closing) {
				this.cleanup().catch((err) => {
					console.error("[Gateway] Cleanup error during close:", err)
				})
			}
		}

		this.client.onclose = async () => {
			console.error("[Gateway] SSE client closed")
			if (!this.closing) {
				// For SSE connections, attempt reconnection before cleanup
				const reconnected = await this.attemptReconnection()
				if (!reconnected) {
					this.cleanup().catch((err) => {
						console.error("[Gateway] Cleanup error during close:", err)
					})
				}
			}
		}

		process.on("SIGINT", () => this.cleanup())
		process.on("SIGTERM", () => this.cleanup())
	}

	private async cleanup(): Promise<void> {
		if (this.closing) {
			return
		}

		this.closing = true
		console.error("[Gateway] Starting cleanup...")

		try {
			if (this.client) {
				console.error("[Gateway] Closing SSE client...")
				await this.client.close()
			}

			if (this.server) {
				console.error("[Gateway] Closing server...")
				await this.server.close()
			}

			console.error("[Gateway] Cleanup completed")
			process.exit(0)
		} catch (error) {
			console.error("[Gateway] Fatal error during cleanup:", error)
			process.exit(1)
		}
	}

	private async handleStdioConnection(
		serverDetails: ResolvedServer,
		config: Record<string, unknown>,
		// Only available if user gives analytics consent
		userId?: string,
	): Promise<void> {
		// Find the STDIO connection details
		const stdioConnection = serverDetails.connections.find(
			(conn) => conn.type === "stdio",
		)
		if (!stdioConnection) {
			throw new Error("No STDIO connection found")
		}

		// Process config values using the connection's schema
		const processedConfig = await collectConfigValues(stdioConnection, config)

		// Get the configured command from registry with processed config
		const response = await fetch(
			`${REGISTRY_ENDPOINT}/servers/${serverDetails.qualifiedName}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					connectionType: "stdio",
					config: processedConfig,
					userId,
				}),
			},
		)

		if (!response.ok) {
			throw new Error(
				`Failed to get server configuration: ${response.statusText}`,
			)
		}

		const { result } = await response.json()
		const serverConfig = result as ConfiguredStdioServer

		console.error("[Gateway] Server configuration:", serverConfig)

		const { command, args, env } = serverConfig
		let clientTransport: StdioClientTransport | null = null

		try {
			// Merge default environment with provided env
			const defaultEnv = getDefaultEnvironment()
			const mergedEnv = {
				...defaultEnv,
				...(env || {}),
			}

			// Create client transport
			clientTransport = new StdioClientTransport({
				command,
				args: args || [],
				env: mergedEnv,
				stderr: "pipe",
			})

			// Set up transport error handling
			clientTransport.onerror = (error) => {
				console.error("[Gateway] STDIO transport error:", error)
				this.cleanup().catch((err) => {
					console.error("[Gateway] Cleanup error during transport error:", err)
				})
			}

			// Connect client to get capabilities
			await this.client.connect(clientTransport)

			// Get capabilities from the client
			const capabilities = this.client.getServerCapabilities() || {}
			console.error("[Gateway] Child process capabilities:", capabilities)

			// Create server with the discovered capabilities
			this.server = new Server(
				{
					name: `smithery-runner-${serverDetails.qualifiedName}`,
					version: "1.0.0",
				},
				{ capabilities },
			)

			// Set up error handling
			this.setupErrorHandling()

			// Set up handlers based on capabilities
			await this.setupHandlers(capabilities)

			// Create and connect server transport
			const serverTransport = new StdioServerTransport()
			await this.server.connect(serverTransport)
			console.error("[Gateway] STDIO server ready")

			// Handle stderr output
			if (clientTransport.stderr) {
				clientTransport.stderr.on("data", (chunk: Buffer) => {
					console.error("[Gateway] Child process stderr:", chunk.toString())
				})
			}

			// Track tool usage if consent is given
			if (userId) {
				const onmessage = serverTransport.onmessage?.bind(serverTransport)
				serverTransport.onmessage = (msg: JSONRPCMessage) => {
					const { data, error } = CallToolRequestSchema.safeParse(msg)
					if (!error && ANALYTICS_ENDPOINT) {
						// Done async
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
									toolParams: pick(data.params, "name"),
								},
							}),
						})
					}
					onmessage?.(msg)
				}
			}
		} catch (error) {
			console.error("[Gateway] Error during STDIO setup:", error)

			// Attempt to clean up the transport if it was created
			if (clientTransport) {
				try {
					await clientTransport.close()
				} catch (closeError) {
					console.error(
						"[Gateway] Error closing transport during error recovery:",
						closeError,
					)
				}
			}

			throw error
		}

		// Add cleanup handler for process termination
		const cleanupHandler = () => {
			if (clientTransport && !this.closing) {
				console.error("[Gateway] Process termination detected, cleaning up...")
				this.cleanup().catch((err) => {
					console.error(
						"[Gateway] Cleanup error during process termination:",
						err,
					)
					process.exit(1)
				})
			}
		}

		process.once("SIGTERM", cleanupHandler)
		process.once("SIGINT", cleanupHandler)
	}

	private async handleSSEConnection(
		serverDetails: ResolvedServer,
		config: Record<string, unknown>,
	): Promise<void> {
		// Store connection details for potential reconnection
		this.currentConnectionDetails = { serverDetails, config }

		// Get SSE connection
		const sseConnection = serverDetails.connections.find(
			(conn) => conn.type === "sse",
		)
		if (!sseConnection?.deploymentUrl) {
			throw new Error("SSE connection missing deployment URL")
		}

		// Add /sse to the deployment URL before creating the Smithery URL
		const sseUrl = new URL("/sse", sseConnection.deploymentUrl).toString()
		const connectionUrl = createSmitheryUrl(sseUrl, config || {})

		console.error(
			"[Gateway] Attempting to connect to SSE server at:",
			connectionUrl,
		)

		try {
			// Connect SSE client first to discover capabilities
			const sseTransport = new SSEClientTransport(new URL(connectionUrl))
			await this.client.connect(sseTransport)
			console.error("[Gateway] Connected to remote SSE server")

			// Reset reconnection attempts after successful connection
			this.reconnectAttempts = 0

			// Get capabilities
			const capabilities = this.client.getServerCapabilities() || {}
			console.error("[Gateway] Remote server capabilities:", capabilities)

			// Create server with the discovered capabilities
			this.server = new Server(
				{
					name: `smithery-runner-${serverDetails.qualifiedName}`,
					version: "1.0.0",
				},
				{ capabilities },
			)

			// Set up error handling
			this.setupErrorHandling()

			// Set up handlers based on remote capabilities
			await this.setupHandlers(capabilities)

			// Finally connect local STDIO server
			const stdioTransport = new StdioServerTransport()
			await this.server.connect(stdioTransport)
			console.error("[Gateway] STDIO server ready")
		} catch (sseError) {
			console.error("[Gateway] Failed to connect to SSE server:", {
				url: connectionUrl,
				error: sseError,
				status: (sseError as any)?.status,
				message: (sseError as any)?.message,
			})
			throw sseError
		}
	}

	private async attemptReconnection(): Promise<boolean> {
		if (this.closing || !this.currentConnectionDetails) {
			return false
		}

		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error("[Gateway] Max reconnection attempts reached")
			return false
		}

		const delay = Math.min(
			this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
			30000, // max 30 seconds
		)

		console.error(
			`[Gateway] Attempting reconnection in ${delay}ms (attempt ${
				this.reconnectAttempts + 1
			}/${this.maxReconnectAttempts})`,
		)

		await new Promise((resolve) => setTimeout(resolve, delay))
		this.reconnectAttempts++

		this.isReconnecting = true

		try {
			await this.handleSSEConnection(
				this.currentConnectionDetails.serverDetails,
				this.currentConnectionDetails.config,
			)
			console.error("[Gateway] Successfully reconnected")
			this.reconnectAttempts = 0
			this.isReconnecting = false
			return true
		} catch (error) {
			console.error("[Gateway] Reconnection failed:", error)
			this.isReconnecting = false
			return false
		}
	}

	public get reconnecting(): boolean {
		return this.isReconnecting
	}

	async run(
		serverDetails: ResolvedServer,
		config: Record<string, unknown>,
		userId?: string,
	): Promise<void> {
		try {
			const hasSSE = serverDetails.connections.some(
				(conn) => conn.type === "sse",
			)
			const hasStdio = serverDetails.connections.some(
				(conn) => conn.type === "stdio",
			)

			if (hasSSE) {
				await this.handleSSEConnection(serverDetails, config)
			} else if (hasStdio) {
				await this.handleStdioConnection(serverDetails, config, userId)
			} else {
				throw new Error("No connection types found. Server not deployed.")
			}
		} catch (error) {
			console.error("[Gateway] Setup error:", error)
			await this.cleanup()
			throw error
		}
	}
}
