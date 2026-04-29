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
import { APIError, type Smithery } from "@smithery/api"
import pc from "picocolors"
import { getRuntimeEnvironment } from "../utils/runtime"
import { debug } from "./logger"
import { createSmitheryClient } from "./smithery-client"

declare const __SMITHERY_VERSION__: string

const MAX_RETRIES = 5
const RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000]
const STDIO_KILL_TIMEOUT_MS = 5000
const LOCAL_HANDSHAKE_ID = "__smithery_uplink_init__"
const DEFAULT_UPLINK_BASE_URL = "https://uplink.smithery.run"

export type UplinkTarget =
	| {
			kind: "uplink-http"
			mcpUrl: string
	  }
	| {
			kind: "uplink-stdio"
			command: string
			args: string[]
			env?: Record<string, string>
	  }

export interface LocalPeer {
	start(): Promise<void>
	close(): Promise<void>
	send(message: JSONRPCMessage): Promise<void>
	onmessage?: (message: JSONRPCMessage) => void
	onclose?: (code?: number) => void
	onerror?: (event: { error: unknown; detail?: string }) => void
}

export interface SocketPeer {
	send(text: string): void
	onmessage?: (data: string | ArrayBuffer) => void
	onclose?: (event: { code: number; reason: string }) => void
	onerror?: (error: unknown) => void
}

type BridgeCloseEvent =
	| { source: "socket"; code: number; reason: string }
	| { source: "local"; code?: number }

type BridgeErrorEvent =
	| { source: "socket"; error: unknown; detail?: string }
	| { source: "local"; error: unknown; detail?: string }

export function wireJsonRpcBridge(options: {
	socket: SocketPeer
	local: LocalPeer
	onClose: (event: BridgeCloseEvent) => void
	onError: (event: BridgeErrorEvent) => void
}): () => void {
	const { socket, local, onClose, onError } = options
	const textDecoder = new TextDecoder()

	socket.onmessage = (data) => {
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
	}

	local.onmessage = (message) => {
		try {
			socket.send(JSON.stringify(message))
		} catch (error) {
			onError({
				source: "socket",
				error,
				detail: describeJsonRpcMessage(message),
			})
		}
	}

	socket.onclose = (event) =>
		onClose({ source: "socket", code: event.code, reason: event.reason })
	local.onclose = (code) => onClose({ source: "local", code })

	socket.onerror = (error) => onError({ source: "socket", error })
	local.onerror = (event) =>
		onError({ source: "local", error: event.error, detail: event.detail })

	return () => {
		socket.onmessage = undefined
		socket.onclose = undefined
		socket.onerror = undefined
		local.onmessage = undefined
		local.onclose = undefined
		local.onerror = undefined
	}
}

export async function serveUplink(options: {
	namespace: string
	connectionId: string
	target: UplinkTarget
	force?: boolean
	onInterrupt?: () => void
}): Promise<number> {
	const client = await createSmitheryClient()
	const local: LocalPeer =
		options.target.kind === "uplink-http"
			? createHttpLocalPeer(options.target.mcpUrl)
			: createStdioLocalPeer(
					options.target.command,
					options.target.args,
					options.target.env,
				)

	let activeSocket: WebSocket | null = null
	let disposeBridge: (() => void) | undefined
	let shuttingDown = false
	let interrupted = false
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
		if (!interrupted) {
			interrupted = true
			options.onInterrupt?.()
		}
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
		const endpoint = getUplinkPairingEndpoint()
		const socket = await pairUplinkSocket({
			client,
			baseURL: endpoint.baseURL,
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
			const connectionPath = buildConnectionPath(
				options.namespace,
				options.connectionId,
			)
			console.log("Pairing uplink ... connected")
			console.log(`Local MCP: ${describeLocalTarget(options.target)}`)
			console.log(`Namespace: ${options.namespace}`)
			console.log(`Connection ID: ${options.connectionId}`)
			console.log(
				`MCP: ${new URL(connectionPath, "https://mcp.smithery.run").toString()}`,
			)
			console.log(
				`REST: ${new URL(connectionPath, "https://smithery.run").toString()}`,
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
	client: Smithery
	baseURL: string
	apiKey: string
	namespace: string
	connectionId: string
	force?: boolean
}): Promise<WebSocket> {
	let preflight: "paired" | "disconnected"
	try {
		preflight = await preflightUplinkPair(options)
	} catch (error) {
		if (
			!options.force ||
			!(error instanceof Error) ||
			error.message !== "Uplink already paired. Use --force to take over."
		) {
			throw error
		}
		preflight = "paired"
	}
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

export async function preflightUplinkPair(options: {
	client: Smithery
	baseURL: string
	namespace: string
	connectionId: string
}): Promise<"paired" | "disconnected"> {
	try {
		await options.client
			.withOptions({ baseURL: toHttpBaseUrl(options.baseURL) })
			.uplink.check(
				options.connectionId,
				{ namespace: options.namespace },
				{ maxRetries: 0 },
			)
		return "paired"
	} catch (error) {
		if (error instanceof APIError) {
			if (error.status === 503) return "disconnected"

			const message = pairStatusError(error.status)
			if (message) throw new Error(message)
		}
		throw error
	}
}

function createSocketPeer(socket: WebSocket): SocketPeer {
	const peer: SocketPeer = {
		send(text) {
			socket.send(text)
		},
	}
	socket.addEventListener("message", (event) => {
		if (typeof event.data === "string" || event.data instanceof ArrayBuffer) {
			peer.onmessage?.(event.data)
			return
		}
		if (ArrayBuffer.isView(event.data)) {
			const bytes = new Uint8Array(
				event.data.buffer,
				event.data.byteOffset,
				event.data.byteLength,
			)
			peer.onmessage?.(Uint8Array.from(bytes).buffer)
		}
	})
	socket.addEventListener("close", (event) => {
		peer.onclose?.({ code: event.code, reason: event.reason })
	})
	socket.addEventListener("error", (event) => {
		const errorEvent = event as ErrorEvent
		peer.onerror?.(errorEvent.error ?? new Error(errorEvent.message))
	})
	return peer
}

function createHttpLocalPeer(mcpUrl: string): LocalPeer {
	const transport = new StreamableHTTPClientTransport(new URL(mcpUrl))
	const adapted: LocalPeer = {
		start: () => transport.start(),
		close: () => transport.close(),
		send: (message) => transport.send(message),
	}
	transport.onmessage = (message) => adapted.onmessage?.(message)
	transport.onclose = () => adapted.onclose?.()
	transport.onerror = (error) => adapted.onerror?.({ error })
	return wrapInitialized(adapted)
}

// The Smithery gateway forwards raw JSON-RPC frames, and for later remote
// sessions it replays a cached initialize response without re-forwarding
// `initialize` to the uplink. A session-aware MCP server still requires a real
// `initialize` + `notifications/initialized` handshake per local session, so
// we run one up front and then satisfy any gateway-forwarded initialize frames
// from the cached local result.
export function wrapInitialized(inner: LocalPeer): LocalPeer {
	const pendingDetails = new Set<string>()

	let cachedInitResult: InitializeResult | undefined
	let handshake:
		| {
				resolve: (result: InitializeResult) => void
				reject: (error: unknown) => void
		  }
		| undefined

	const outer: LocalPeer = {
		async start() {
			await inner.start()
			cachedInitResult = await new Promise<InitializeResult>(
				(resolve, reject) => {
					handshake = { resolve, reject }
					inner
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
			await inner.send({
				jsonrpc: "2.0",
				method: "notifications/initialized",
			})
		},
		async send(message) {
			if (isInitializeRequest(message) && cachedInitResult !== undefined) {
				outer.onmessage?.({
					jsonrpc: "2.0",
					id: message.id,
					result: cachedInitResult,
				})
				return
			}

			if (isInitializedNotification(message)) {
				return
			}

			const detail = describeJsonRpcMessage(message)
			pendingDetails.add(detail)
			try {
				await inner.send(message)
			} finally {
				pendingDetails.delete(detail)
			}
		},
		close() {
			return inner.close()
		},
	}

	inner.onmessage = (message) => {
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
		outer.onmessage?.(message)
	}

	inner.onclose = (code) => {
		if (handshake !== undefined) {
			const pending = handshake
			handshake = undefined
			pending.reject(new Error("Local MCP closed before initialize completed."))
		}
		outer.onclose?.(code)
	}

	inner.onerror = (event) => {
		if (handshake !== undefined) {
			const pending = handshake
			handshake = undefined
			pending.reject(event.error)
			return
		}
		outer.onerror?.({
			error: event.error,
			detail: event.detail ?? formatPendingDetails(pendingDetails),
		})
	}

	return outer
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
	extraEnv?: Record<string, string>,
): LocalPeer {
	const resolved = resolveSpawnCommand(command, args)
	let child: ReturnType<typeof spawn> | null = null

	const inner: LocalPeer = {
		start() {
			return new Promise<void>((resolve, reject) => {
				const readBuffer = new ReadBuffer()
				child = spawn(resolved.command, resolved.args, {
					cwd: process.cwd(),
					env: getRuntimeEnvironment({
						...getStringEnv(process.env),
						...(extraEnv ?? {}),
					}),
					stdio: ["pipe", "pipe", "inherit"],
					shell: false,
				})

				child.on("error", (error) => {
					reject(error)
					inner.onerror?.({ error })
				})

				child.on("spawn", () => resolve())

				child.on("close", (code, signal) => {
					child = null
					inner.onclose?.(code ?? (signal ? 1 : 0))
				})

				child.stdout?.on("data", (chunk: Buffer) => {
					readBuffer.append(chunk)
					while (true) {
						try {
							const message = readBuffer.readMessage()
							if (message === null) {
								break
							}
							inner.onmessage?.(message)
						} catch (error) {
							inner.onerror?.({ error })
							break
						}
					}
				})

				child.stdout?.on("error", (error) => inner.onerror?.({ error }))
				child.stdin?.on("error", (error) => inner.onerror?.({ error }))
			})
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

	return wrapInitialized(inner)
}

export function getUplinkBaseUrl(): string {
	return getUplinkPairingEndpoint().baseURL
}

export function getUplinkPairingEndpoint(): {
	baseURL: string
} {
	if (process.env.SMITHERY_UPLINK_BASE_URL) {
		return { baseURL: process.env.SMITHERY_UPLINK_BASE_URL }
	}

	if (process.env.SMITHERY_DEV_CONNECT_UPLINK_URL) {
		return { baseURL: process.env.SMITHERY_DEV_CONNECT_UPLINK_URL }
	}

	if (process.env.SMITHERY_MCP_BASE_URL) {
		return { baseURL: process.env.SMITHERY_MCP_BASE_URL }
	}

	return { baseURL: DEFAULT_UPLINK_BASE_URL }
}

function encodePathSegment(value: string): string {
	return encodeURIComponent(value)
}

function buildConnectionPath(namespace: string, connectionId: string): string {
	const encodedConnectionPath = connectionId
		.split("/")
		.map(encodePathSegment)
		.join("/")
	return `/${encodePathSegment(namespace)}/${encodedConnectionPath}`
}

export function buildPairUrl(
	baseURL: string,
	namespace: string,
	connectionId: string,
	force = false,
): string {
	const url = new URL(buildConnectionPath(namespace, connectionId), baseURL)
	if (force) {
		url.searchParams.set("force", "1")
	}
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
	return url.toString()
}

function toHttpBaseUrl(baseURL: string): string {
	const url = new URL(baseURL)
	if (url.protocol === "wss:") url.protocol = "https:"
	if (url.protocol === "ws:") url.protocol = "http:"
	return url.toString()
}

function pairStatusError(status: number): string | undefined {
	if (status === 401) {
		return "Authentication failed. Run 'smithery login' to re-authenticate."
	}

	if (status === 403) {
		return "Permission denied. Your token needs connections:write on this namespace."
	}

	if (status === 404) {
		return "Connection not found."
	}

	if (status === 409) {
		return "Uplink already paired. Use --force to take over."
	}
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
