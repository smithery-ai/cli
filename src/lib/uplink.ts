import { spawn } from "node:child_process"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import {
	ReadBuffer,
	serializeMessage,
} from "@modelcontextprotocol/sdk/shared/stdio.js"
import {
	type JSONRPCMessage,
	JSONRPCMessageSchema,
} from "@modelcontextprotocol/sdk/types.js"
import pc from "picocolors"
import { getRuntimeEnvironment } from "../utils/runtime"
import { createSmitheryClient } from "./smithery-client"

const MAX_RETRIES = 5
const RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000]
const STDIO_KILL_TIMEOUT_MS = 5000

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
	onError(listener: (error: unknown) => void): (() => void) | undefined
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
	| { source: "socket"; error: unknown }
	| { source: "local"; error: unknown }

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
					onError({ source: "local", error })
				}
			})()
		}),
	)

	addCleanup(
		local.onMessage((message) => {
			try {
				socket.send(JSON.stringify(message))
			} catch (error) {
				onError({ source: "socket", error })
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
		local.onError((error) => {
			onError({ source: "local", error })
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
					console.error(pc.yellow(formatError(event.error)))
					if (
						activeSocket === socket &&
						socket.readyState < WebSocket.CLOSING
					) {
						socket.close()
					}
					return
				}

				console.error(pc.red(formatError(event.error)))
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
						console.error(pc.red(formatError(error)))
						void stop(1)
					})
			},
		})

		if (!pairedOnce) {
			pairedOnce = true
			console.log("Pairing uplink ... connected")
			console.log(`Local MCP: ${describeLocalTarget(options.target)}`)
			console.log(
				`Smithery: ${options.namespace}/${options.connectionId} (${getConnectionUrl(options.namespace, options.connectionId)})`,
			)
			console.log("Tool calls will route here. Press Ctrl-C to stop.")
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

function createHttpLocalPeer(mcpUrl: string): ManagedLocalPeer {
	const transport = new StreamableHTTPClientTransport(new URL(mcpUrl))
	const messageListeners = new Set<(message: JSONRPCMessage) => void>()
	const closeListeners = new Set<(code?: number) => void>()
	const errorListeners = new Set<(error: unknown) => void>()

	transport.onmessage = (message) => {
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
		for (const listener of errorListeners) {
			listener(error)
		}
	}

	return {
		async start() {
			await transport.start()
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
			return transport.send(message)
		},
		close() {
			return transport.close()
		},
	}
}

function createStdioLocalPeer(
	command: string,
	args: string[],
): ManagedLocalPeer {
	const resolved = resolveSpawnCommand(command, args)
	const readBuffer = new ReadBuffer()
	const messageListeners = new Set<(message: JSONRPCMessage) => void>()
	const closeListeners = new Set<(code?: number) => void>()
	const errorListeners = new Set<(error: unknown) => void>()
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
						listener(error)
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
								listener(error)
							}
							break
						}
					}
				})

				child.stdout?.on("error", (error) => {
					for (const listener of errorListeners) {
						listener(error)
					}
				})

				child.stdin?.on("error", (error) => {
					for (const listener of errorListeners) {
						listener(error)
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

function getConnectionUrl(namespace: string, connectionId: string): string {
	return `https://smithery.ai/connect/${encodeURIComponent(namespace)}/${encodeURIComponent(connectionId)}`
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

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
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
