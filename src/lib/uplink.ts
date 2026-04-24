import { spawn } from "node:child_process"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import {
	ReadBuffer,
	serializeMessage,
} from "@modelcontextprotocol/sdk/shared/stdio.js"
import {
	type InitializeResult,
	type JSONRPCMessage,
	JSONRPCMessageSchema,
	LATEST_PROTOCOL_VERSION,
} from "@modelcontextprotocol/sdk/types.js"
import pc from "picocolors"
import { getRuntimeEnvironment } from "../utils/runtime"
import { debug } from "./logger"
import { createSmitheryClient } from "./smithery-client"

declare const __SMITHERY_VERSION__: string

const MAX_RETRIES = 5
const RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000]
const STDIO_KILL_TIMEOUT_MS = 5000
const LOCAL_HANDSHAKE_ID = "__smithery_uplink_init__"

export type UplinkTarget =
	| {
			kind: "uplink-http"
			mcpUrl: string
	  }
	| {
			kind: "uplink-stdio"
			command: string
			args: string[]
	  }

type BridgeSocketPeer = {
	onMessage(
		listener: (data: string | ArrayBuffer) => void,
	): (() => void) | undefined
	onClose(
		listener: (event: { code: number; reason: string }) => void,
	): (() => void) | undefined
	onError(listener: (error: unknown) => void): (() => void) | undefined
	send(text: string): void
}

type BridgeLocalPeer = {
	onMessage(
		listener: (message: JSONRPCMessage) => void,
	): (() => void) | undefined
	onClose(listener: (code?: number) => void): (() => void) | undefined
	onError(
		listener: (event: { error: unknown; detail?: string }) => void,
	): (() => void) | undefined
	send(message: JSONRPCMessage): Promise<void>
}

type ManagedLocalPeer = BridgeLocalPeer & {
	close(): Promise<void>
	start(): Promise<void>
}

type BridgeCloseEvent =
	| { source: "socket"; code: number; reason: string }
	| { source: "local"; code?: number }

type BridgeErrorEvent =
	| { source: "socket"; error: unknown; detail?: string }
	| { source: "local"; error: unknown; detail?: string }

export function wireJsonRpcBridge(options: {
	socket: BridgeSocketPeer
	local: BridgeLocalPeer
	onClose: (event: BridgeCloseEvent) => void
	onError: (event: BridgeErrorEvent) => void
}): () => void {
	const { socket, local, onClose, onError } = options
	const textDecoder = new TextDecoder()
	const cleanups: Array<() => void> = []

	const addCleanup = (cleanup: (() => void) | undefined) => {
		if (typeof cleanup === "function") {
			cleanups.push(cleanup)
		}
	}

	addCleanup(
		socket.onMessage((data) => {
			void (async () => {
				const text =
					typeof data === "string"
						? data
						: textDecoder.decode(new Uint8Array(data))
				let message: JSONRPCMessage
				try {
					message = JSONRPCMessageSchema.parse(JSON.parse(text))
				} catch (error) {
					onError({ source: "socket", error })
					return
				}

				try {
					await local.send(message)
				} catch (error) {
					onError({
						source: "local",
						error,
						detail: describeJsonRpcMessage(message),
					})
				}
			})()
		}),
	)

	addCleanup(
		local.onMessage((message) => {
			try {
				socket.send(JSON.stringify(message))
			} catch (error) {
				onError({
					source: "socket",
					error,
					detail: describeJsonRpcMessage(message),
				})
			}
		}),
	)

	addCleanup(
		socket.onClose((event) => {
			onClose({
				source: "socket",
				code: event.code,
				reason: event.reason,
			})
		}),
	)

	addCleanup(
		local.onClose((code) => {
			onClose({
				source: "local",
				code,
			})
		}),
	)

	addCleanup(
		socket.onError((error) => {
			onError({ source: "socket", error })
		}),
	)
	addCleanup(
		local.onError((event) => {
			onError({
				source: "local",
				error: event.error,
				detail: event.detail,
			})
		}),
	)

	return () => {
		for (const cleanup of cleanups.splice(0)) {
			cleanup()
		}
	}
}

export async function serveUplink(options: {
	namespace: string
	connectionId: string
	target: UplinkTarget
	force?: boolean
}): Promise<number> {
	const client = await createSmitheryClient()
	const local: ManagedLocalPeer =
		options.target.kind === "uplink-http"
			? createHttpLocalPeer(options.target.mcpUrl)
			: createStdioLocalPeer(options.target.command, options.target.args)

	let activeSocket: WebSocket | null = null
	let disposeBridge: (() => void) | undefined
	let shuttingDown = false
	let pairedOnce = false
	const done = createDeferred<number>()

	const stop = async (exitCode: number) => {
		if (shuttingDown) {
			return
		}

		shuttingDown = true
		disposeBridge?.()
		disposeBridge = undefined

		removeSignalHandlers()

		if (activeSocket) {
			try {
				activeSocket.close(1000, "closing")
			} catch {
				// Ignore close errors during shutdown.
			}
			activeSocket = null
		}

		await local.close().catch(() => {
			// Ignore cleanup failures during shutdown.
		})

		done.resolve(exitCode)
	}

	const handleSignal = () => {
		void stop(0)
	}

	const removeSignalHandlers = () => {
		process.off("SIGINT", handleSignal)
		process.off("SIGTERM", handleSignal)
	}

	process.on("SIGINT", handleSignal)
	process.on("SIGTERM", handleSignal)

	if (options.target.kind === "uplink-stdio") {
		console.log(
			`Local command: ${formatShellCommand(
				options.target.command,
				options.target.args,
			)}`,
		)
	}

	const connect = async (attempt: number) => {
		const socket = await pairUplinkSocket({
			baseURL: client.baseURL,
			apiKey: client.apiKey,
			namespace: options.namespace,
			connectionId: options.connectionId,
			force: options.force || attempt > 0,
		})

		activeSocket = socket
		disposeBridge?.()

		const socketPeer = createSocketPeer(socket)
		disposeBridge = wireJsonRpcBridge({
			socket: socketPeer,
			local,
			onError: (event) => {
				if (shuttingDown) {
					return
				}

				if (event.source === "socket") {
					console.error(pc.yellow(formatBridgeError(event)))
					debug(formatErrorDebug(event.error))
					if (
						activeSocket === socket &&
						socket.readyState < WebSocket.CLOSING
					) {
						socket.close()
					}
					return
				}

				console.error(
					pc.red(
						formatBridgeError(event, {
							localTarget: describeLocalTarget(options.target),
						}),
					),
				)
				debug(formatErrorDebug(event.error))
				void stop(1)
			},
			onClose: (event) => {
				disposeBridge?.()
				disposeBridge = undefined
				activeSocket = null

				if (shuttingDown) {
					return
				}

				if (event.source === "local") {
					void stop(event.code ?? 1)
					return
				}

				if (event.code === 1001 && event.reason === "replaced") {
					console.error(pc.yellow("Uplink replaced by another session."))
					void stop(1)
					return
				}

				if (attempt >= MAX_RETRIES) {
					console.error(pc.red("Uplink disconnected. Retry limit exceeded."))
					void stop(1)
					return
				}

				const nextAttempt = attempt + 1
				const delayMs =
					RETRY_DELAYS_MS[Math.min(nextAttempt - 1, RETRY_DELAYS_MS.length - 1)]
				console.error(
					pc.yellow(
						`Uplink disconnected. Reconnecting (${nextAttempt}/${MAX_RETRIES}) in ${delayMs}ms...`,
					),
				)
				void delay(delayMs)
					.then(() => connect(nextAttempt))
					.catch((error) => {
						console.error(pc.red(formatErrorMessage(error)))
						void stop(1)
					})
			},
		})

		if (!pairedOnce) {
			pairedOnce = true
			console.log("Pairing uplink ... connected")
			console.log(`Local MCP: ${describeLocalTarget(options.target)}`)
			console.log(`Namespace: ${options.namespace}`)
			console.log(`Connection ID: ${options.connectionId}`)
			console.log(
				`MCP: https://mcp.smithery.run/${encodeURIComponent(options.namespace)}/${encodeURIComponent(options.connectionId)}`,
			)
			console.log(
				`REST: https://smithery.run/${encodeURIComponent(options.namespace)}/${encodeURIComponent(options.connectionId)}`,
			)
			console.log("Press Ctrl-C to stop.")
			return
		}

		console.log(`Pairing uplink ... reconnected (${attempt}/${MAX_RETRIES})`)
	}

	try {
		await local.start()
		await connect(0)
		return await done.promise
	} catch (error) {
		await stop(1)
		throw error
	}
}

async function pairUplinkSocket(options: {
	baseURL: string
	apiKey: string
	namespace: string
	connectionId: string
	force?: boolean
}): Promise<WebSocket> {
	const preflight = await preflightUplinkPair(options)
	if (preflight === "paired" && !options.force) {
		throw new Error("Uplink already paired. Use --force to take over.")
	}

	const url = buildPairUrl(
		options.baseURL,
		options.namespace,
		options.connectionId,
		options.force,
	)

	return new Promise<WebSocket>((resolve, reject) => {
		const socket = new WebSocket(url, {
			headers: {
				Authorization: `Bearer ${options.apiKey}`,
			},
		} as unknown as ConstructorParameters<typeof WebSocket>[1])

		const cleanup = () => {
			socket.removeEventListener("open", onOpen)
			socket.removeEventListener("error", onError)
			socket.removeEventListener("close", onClose)
		}

		const onOpen = () => {
			cleanup()
			resolve(socket)
		}

		const onError = () => {
			cleanup()
			reject(new Error("Failed to pair uplink."))
		}

		const onClose = (event: Event) => {
			cleanup()
			const closeEvent = event as CloseEvent
			reject(
				new Error(
					closeEvent.reason ||
						`Failed to pair uplink (code ${closeEvent.code}).`,
				),
			)
		}

		socket.addEventListener("open", onOpen)
		socket.addEventListener("error", onError)
		socket.addEventListener("close", onClose)
	})
}

async function preflightUplinkPair(options: {
	baseURL: string
	apiKey: string
	namespace: string
	connectionId: string
}): Promise<"paired" | "disconnected"> {
	const response = await fetch(
		buildHttpPairUrl(options.baseURL, options.namespace, options.connectionId),
		{
			headers: {
				Authorization: `Bearer ${options.apiKey}`,
			},
		},
	)

	if (response.status === 200) {
		await response.body?.cancel()
		return "paired"
	}

	if (response.status === 503) {
		await response.body?.cancel()
		return "disconnected"
	}

	throw new Error(await readPairError(response))
}

function createSocketPeer(socket: WebSocket): BridgeSocketPeer {
	return {
		onMessage(listener) {
			const handler = (event: MessageEvent) => {
				if (
					typeof event.data === "string" ||
					event.data instanceof ArrayBuffer
				) {
					listener(event.data)
					return
				}

				if (ArrayBuffer.isView(event.data)) {
					const bytes = new Uint8Array(
						event.data.buffer,
						event.data.byteOffset,
						event.data.byteLength,
					)
					listener(Uint8Array.from(bytes).buffer)
				}
			}
			socket.addEventListener("message", handler)
			return () => socket.removeEventListener("message", handler)
		},
		onClose(listener) {
			const handler = (event: CloseEvent) => {
				listener({ code: event.code, reason: event.reason })
			}
			socket.addEventListener("close", handler)
			return () => socket.removeEventListener("close", handler)
		},
		onError(listener) {
			const handler = (event: Event) => {
				const errorEvent = event as ErrorEvent
				listener(errorEvent.error ?? new Error(errorEvent.message))
			}
			socket.addEventListener("error", handler)
			return () => socket.removeEventListener("error", handler)
		},
		send(text) {
			socket.send(text)
		},
	}
}

export interface LocalHttpTransport {
	start(): Promise<void>
	close(): Promise<void>
	send(message: JSONRPCMessage): Promise<void>
	onmessage?: (message: JSONRPCMessage) => void
	onclose?: () => void
	onerror?: (error: Error) => void
}

function createHttpLocalPeer(mcpUrl: string): ManagedLocalPeer {
	return wrapLocalHttpTransport(
		new StreamableHTTPClientTransport(new URL(mcpUrl)),
	)
}

// The Smithery gateway forwards raw JSON-RPC frames, and for later remote
// sessions it replays a cached initialize response without re-forwarding
// `initialize` to the uplink. A session-aware HTTP MCP server still requires
// a real `initialize` + `notifications/initialized` handshake per local
// session, so we run one up front and then satisfy any gateway-forwarded
// initialize frames from the cached local result.
export function wrapLocalHttpTransport(
	transport: LocalHttpTransport,
): ManagedLocalPeer {
	const messageListeners = new Set<(message: JSONRPCMessage) => void>()
	const closeListeners = new Set<(code?: number) => void>()
	const errorListeners = new Set<
		(event: { error: unknown; detail?: string }) => void
	>()
	const pendingDetails = new Set<string>()

	let cachedInitResult: InitializeResult | undefined
	let handshake:
		| {
				resolve: (result: InitializeResult) => void
				reject: (error: unknown) => void
		  }
		| undefined

	transport.onmessage = (message) => {
		if (
			handshake !== undefined &&
			"id" in message &&
			message.id === LOCAL_HANDSHAKE_ID
		) {
			const pending = handshake
			handshake = undefined
			if ("result" in message) {
				pending.resolve(message.result as InitializeResult)
			} else if ("error" in message) {
				pending.reject(
					new Error(`Local MCP initialize failed: ${message.error.message}`),
				)
			} else {
				pending.reject(new Error("Local MCP initialize returned no result"))
			}
			return
		}
		for (const listener of messageListeners) {
			listener(message)
		}
	}
	transport.onclose = () => {
		for (const listener of closeListeners) {
			listener(1)
		}
	}
	transport.onerror = (error) => {
		if (handshake !== undefined) {
			const pending = handshake
			handshake = undefined
			pending.reject(error)
			return
		}
		for (const listener of errorListeners) {
			listener({
				error,
				detail: formatPendingDetails(pendingDetails),
			})
		}
	}

	return {
		async start() {
			await transport.start()
			cachedInitResult = await new Promise<InitializeResult>(
				(resolve, reject) => {
					handshake = { resolve, reject }
					transport
						.send({
							jsonrpc: "2.0",
							id: LOCAL_HANDSHAKE_ID,
							method: "initialize",
							params: {
								protocolVersion: LATEST_PROTOCOL_VERSION,
								capabilities: {},
								clientInfo: {
									name: "@smithery/cli",
									version: __SMITHERY_VERSION__,
								},
							},
						})
						.catch((error) => {
							handshake = undefined
							reject(error)
						})
				},
			)
			await transport.send({
				jsonrpc: "2.0",
				method: "notifications/initialized",
			})
		},
		onMessage(listener) {
			messageListeners.add(listener)
			return () => messageListeners.delete(listener)
		},
		onClose(listener) {
			closeListeners.add(listener)
			return () => closeListeners.delete(listener)
		},
		onError(listener) {
			errorListeners.add(listener)
			return () => errorListeners.delete(listener)
		},
		async send(message) {
			if (isInitializeRequest(message) && cachedInitResult !== undefined) {
				const reply: JSONRPCMessage = {
					jsonrpc: "2.0",
					id: message.id,
					result: cachedInitResult,
				}
				for (const listener of messageListeners) {
					listener(reply)
				}
				return
			}

			if (isInitializedNotification(message)) {
				return
			}

			const detail = describeJsonRpcMessage(message)
			pendingDetails.add(detail)
			try {
				await transport.send(message)
			} finally {
				pendingDetails.delete(detail)
			}
		},
		close() {
			return transport.close()
		},
	}
}

function isInitializeRequest(
	message: JSONRPCMessage,
): message is Extract<JSONRPCMessage, { id: string | number; method: string }> {
	return (
		"method" in message &&
		message.method === "initialize" &&
		"id" in message &&
		message.id !== undefined
	)
}

function isInitializedNotification(message: JSONRPCMessage): boolean {
	return (
		"method" in message &&
		message.method === "notifications/initialized" &&
		!("id" in message && message.id !== undefined)
	)
}

function createStdioLocalPeer(
	command: string,
	args: string[],
): ManagedLocalPeer {
	const resolved = resolveSpawnCommand(command, args)
	const readBuffer = new ReadBuffer()
	const messageListeners = new Set<(message: JSONRPCMessage) => void>()
	const closeListeners = new Set<(code?: number) => void>()
	const errorListeners = new Set<
		(event: { error: unknown; detail?: string }) => void
	>()
	let child: ReturnType<typeof spawn> | null = null

	return {
		start() {
			return new Promise<void>((resolve, reject) => {
				child = spawn(resolved.command, resolved.args, {
					cwd: process.cwd(),
					env: getRuntimeEnvironment(getStringEnv(process.env)),
					stdio: ["pipe", "pipe", "inherit"],
					shell: false,
				})

				child.on("error", (error) => {
					reject(error)
					for (const listener of errorListeners) {
						listener({ error })
					}
				})

				child.on("spawn", () => resolve())

				child.on("close", (code, signal) => {
					child = null
					const exitCode = code ?? (signal ? 1 : 0)
					for (const listener of closeListeners) {
						listener(exitCode)
					}
				})

				child.stdout?.on("data", (chunk: Buffer) => {
					readBuffer.append(chunk)
					while (true) {
						try {
							const message = readBuffer.readMessage()
							if (message === null) {
								break
							}
							for (const listener of messageListeners) {
								listener(message)
							}
						} catch (error) {
							for (const listener of errorListeners) {
								listener({ error })
							}
							break
						}
					}
				})

				child.stdout?.on("error", (error) => {
					for (const listener of errorListeners) {
						listener({ error })
					}
				})

				child.stdin?.on("error", (error) => {
					for (const listener of errorListeners) {
						listener({ error })
					}
				})
			})
		},
		onMessage(listener) {
			messageListeners.add(listener)
			return () => messageListeners.delete(listener)
		},
		onClose(listener) {
			closeListeners.add(listener)
			return () => closeListeners.delete(listener)
		},
		onError(listener) {
			errorListeners.add(listener)
			return () => errorListeners.delete(listener)
		},
		send(message) {
			return writeToChild(child, serializeMessage(message))
		},
		async close() {
			if (!child) {
				return
			}

			const processToClose = child
			child = null
			const closePromise = waitForProcessExit(processToClose)

			try {
				processToClose.stdin?.end()
			} catch {
				// Ignore stdin close failures.
			}

			await Promise.race([closePromise, delay(STDIO_KILL_TIMEOUT_MS)])
			if (processToClose.exitCode === null) {
				processToClose.kill("SIGTERM")
			}

			await Promise.race([closePromise, delay(STDIO_KILL_TIMEOUT_MS)])
			if (processToClose.exitCode === null) {
				processToClose.kill("SIGKILL")
			}
		},
	}
}

function buildPairUrl(
	baseURL: string,
	namespace: string,
	connectionId: string,
	force = false,
): string {
	const url = new URL(
		`/connect/${encodeURIComponent(namespace)}/${encodeURIComponent(connectionId)}/uplink`,
		baseURL,
	)
	if (force) {
		url.searchParams.set("force", "1")
	}
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
	return url.toString()
}

function buildHttpPairUrl(
	baseURL: string,
	namespace: string,
	connectionId: string,
): string {
	return new URL(
		`/connect/${encodeURIComponent(namespace)}/${encodeURIComponent(connectionId)}/uplink`,
		baseURL,
	).toString()
}

async function readPairError(response: Response): Promise<string> {
	const text = await response.text().catch(() => "")
	try {
		const parsed = JSON.parse(text) as { message?: string }
		if (parsed.message) {
			return parsed.message
		}
	} catch {
		// Ignore JSON parse errors and fall back to plain text.
	}

	if (response.status === 401) {
		return "Authentication failed. Run 'smithery login' to re-authenticate."
	}

	if (response.status === 403) {
		return "Permission denied. Your token needs connections:write on this namespace."
	}

	if (response.status === 404) {
		return "Connection not found."
	}

	return text || `Request failed with status ${response.status}.`
}

function describeLocalTarget(target: UplinkTarget): string {
	if (target.kind === "uplink-http") {
		return target.mcpUrl
	}
	return formatShellCommand(target.command, target.args)
}

function resolveSpawnCommand(
	command: string,
	args: string[],
): { command: string; args: string[] } {
	if (process.platform === "win32" && command === "npx") {
		return {
			command: "cmd",
			args: ["/c", "npx", ...args],
		}
	}

	return { command, args }
}

function getStringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
	return Object.fromEntries(
		Object.entries(env).filter((entry): entry is [string, string] => {
			return typeof entry[1] === "string"
		}),
	)
}

async function writeToChild(
	child: ReturnType<typeof spawn> | null,
	payload: string,
): Promise<void> {
	if (!child?.stdin) {
		throw new Error("Local MCP process is not running.")
	}

	await new Promise<void>((resolve, reject) => {
		child.stdin?.once("error", reject)
		if (child.stdin?.write(payload)) {
			child.stdin?.removeListener("error", reject)
			resolve()
			return
		}
		child.stdin?.once("drain", () => {
			child.stdin?.removeListener("error", reject)
			resolve()
		})
	})
}

function waitForProcessExit(child: ReturnType<typeof spawn>): Promise<void> {
	return new Promise((resolve) => {
		child.once("close", () => resolve())
	})
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms)
		timer.unref?.()
	})
}

function formatShellCommand(command: string, args: string[]): string {
	return [command, ...args]
		.map((part) => {
			if (/^[A-Za-z0-9_./:@=-]+$/.test(part)) {
				return part
			}
			return JSON.stringify(part)
		})
		.join(" ")
}

function describeJsonRpcMessage(message: JSONRPCMessage): string {
	if (!("method" in message)) {
		if ("id" in message && message.id !== undefined) {
			return `response (id ${String(message.id)})`
		}
		return "response"
	}

	const parts = [message.method]
	if ("id" in message && message.id !== undefined) {
		parts.push(`id ${String(message.id)}`)
	}

	const toolName = getToolName(message)
	if (toolName) {
		parts.push(`tool ${toolName}`)
	}

	if (parts.length === 1) {
		return parts[0]
	}

	return `${parts[0]} (${parts.slice(1).join(", ")})`
}

function getToolName(message: JSONRPCMessage): string | undefined {
	if (!("method" in message) || message.method !== "tools/call") {
		return undefined
	}

	const params =
		"params" in message &&
		message.params &&
		typeof message.params === "object" &&
		!Array.isArray(message.params)
			? message.params
			: undefined

	return typeof params?.name === "string" ? params.name : undefined
}

function formatPendingDetails(details: Set<string>): string | undefined {
	if (details.size === 0) {
		return undefined
	}

	if (details.size === 1) {
		return details.values().next().value
	}

	return Array.from(details).join("; ")
}

export function formatBridgeError(
	event: BridgeErrorEvent,
	options: { localTarget?: string } = {},
): string {
	const lines: string[] = []

	if (event.source === "local" && options.localTarget) {
		lines.push(`Local MCP: ${options.localTarget}`)
	}

	if (event.detail) {
		lines.push(`Message: ${event.detail}`)
	}

	lines.push(`Error: ${formatErrorMessage(event.error)}`)

	for (const cause of getErrorCauseMessages(event.error)) {
		lines.push(`Cause: ${cause}`)
	}

	return lines.join("\n")
}

function formatErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function getErrorCauseMessages(error: unknown): string[] {
	const causes: string[] = []
	let current = getErrorCause(error)

	while (current !== undefined) {
		causes.push(formatErrorMessage(current))
		current = getErrorCause(current)
	}

	return causes
}

function getErrorCause(error: unknown): unknown {
	if (!(error instanceof Error) || !("cause" in error)) {
		return undefined
	}

	return error.cause
}

function formatErrorDebug(error: unknown): string {
	const stacks: string[] = []
	let current: unknown = error
	let index = 0

	while (current !== undefined) {
		const stack =
			current instanceof Error && typeof current.stack === "string"
				? current.stack
				: formatErrorMessage(current)
		stacks.push(index === 0 ? stack : `cause[${index}]: ${stack}`)
		current = getErrorCause(current)
		index += 1
	}

	return stacks.join("\n")
}

function createDeferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}
