import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"
import { describe, expect, test, vi } from "vitest"
import {
	formatBridgeError,
	type LocalHttpTransport,
	wireJsonRpcBridge,
	wrapLocalHttpTransport,
} from "../uplink"

declare global {
	var __SMITHERY_VERSION__: string
}
globalThis.__SMITHERY_VERSION__ = globalThis.__SMITHERY_VERSION__ ?? "test"

function createSocketPeer() {
	const listeners: {
		message?: (data: string | ArrayBuffer) => void
		close?: (event: { code: number; reason: string }) => void
		error?: (error: unknown) => void
	} = {}

	return {
		sent: [] as string[],
		onMessage(listener: (data: string | ArrayBuffer) => void) {
			listeners.message = listener
			return undefined
		},
		onClose(listener: (event: { code: number; reason: string }) => void) {
			listeners.close = listener
			return undefined
		},
		onError(listener: (error: unknown) => void) {
			listeners.error = listener
			return undefined
		},
		send(text: string) {
			this.sent.push(text)
		},
		emitMessage(data: string | ArrayBuffer) {
			listeners.message?.(data)
		},
		emitClose(event: { code: number; reason: string }) {
			listeners.close?.(event)
		},
		emitError(error: unknown) {
			listeners.error?.(error)
		},
	}
}

function createLocalPeer(options?: {
	send?: (message: JSONRPCMessage) => Promise<void>
}) {
	const listeners: {
		message?: (message: JSONRPCMessage) => void
		close?: (code?: number) => void
		error?: (event: { error: unknown; detail?: string }) => void
	} = {}

	return {
		sent: [] as JSONRPCMessage[],
		onMessage(listener: (message: JSONRPCMessage) => void) {
			listeners.message = listener
			return undefined
		},
		onClose(listener: (code?: number) => void) {
			listeners.close = listener
			return undefined
		},
		onError(listener: (event: { error: unknown; detail?: string }) => void) {
			listeners.error = listener
			return undefined
		},
		async send(message: JSONRPCMessage) {
			this.sent.push(message)
			await options?.send?.(message)
		},
		emitMessage(message: JSONRPCMessage) {
			listeners.message?.(message)
		},
		emitClose(code?: number) {
			listeners.close?.(code)
		},
		emitError(error: unknown, detail?: string) {
			listeners.error?.({ error, detail })
		},
	}
}

describe("wireJsonRpcBridge", () => {
	test("forwards frames in both directions without changing payloads", async () => {
		const socket = createSocketPeer()
		const local = createLocalPeer()
		const onClose = vi.fn()
		const onError = vi.fn()

		wireJsonRpcBridge({ socket, local, onClose, onError })

		const response = {
			jsonrpc: "2.0",
			id: 1,
			result: { ok: true },
		} satisfies JSONRPCMessage
		local.emitMessage(response)

		expect(socket.sent).toEqual([JSON.stringify(response)])

		const request = {
			jsonrpc: "2.0",
			id: 2,
			method: "tools/list",
		} satisfies JSONRPCMessage
		socket.emitMessage(JSON.stringify(request))

		expect(local.sent).toEqual([request])
		expect(onError).not.toHaveBeenCalled()
		expect(onClose).not.toHaveBeenCalled()
	})

	test("accepts websocket binary frames and reports invalid json", async () => {
		const socket = createSocketPeer()
		const local = createLocalPeer()
		const onClose = vi.fn()
		const onError = vi.fn()

		wireJsonRpcBridge({ socket, local, onClose, onError })

		const binaryMessage = new TextEncoder().encode(
			JSON.stringify({
				jsonrpc: "2.0",
				method: "notifications/initialized",
			}),
		).buffer
		socket.emitMessage(binaryMessage)

		expect(local.sent).toEqual([
			{
				jsonrpc: "2.0",
				method: "notifications/initialized",
			},
		])

		socket.emitMessage("{")
		await vi.waitFor(() => {
			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({ source: "socket" }),
			)
		})
	})

	test("tags socket and local transport errors separately", () => {
		const socket = createSocketPeer()
		const local = createLocalPeer()
		const onClose = vi.fn()
		const onError = vi.fn()

		wireJsonRpcBridge({ socket, local, onClose, onError })

		const socketError = new Error("socket failed")
		socket.emitError(socketError)
		expect(onError).toHaveBeenCalledWith({
			source: "socket",
			error: socketError,
		})

		const localError = new Error("local failed")
		local.emitError(localError)
		expect(onError).toHaveBeenCalledWith({
			source: "local",
			error: localError,
		})
	})

	test("includes request context when forwarding local send failures", async () => {
		const socket = createSocketPeer()
		const error = new TypeError("fetch failed", {
			cause: new Error("connect ECONNREFUSED 127.0.0.1:8787"),
		})
		const local = createLocalPeer({
			async send() {
				throw error
			},
		})
		const onClose = vi.fn()
		const onError = vi.fn()

		wireJsonRpcBridge({ socket, local, onClose, onError })

		socket.emitMessage(
			JSON.stringify({
				jsonrpc: "2.0",
				id: 7,
				method: "tools/call",
				params: { name: "searchDocs" },
			} satisfies JSONRPCMessage),
		)

		await vi.waitFor(() => {
			expect(onError).toHaveBeenCalledWith({
				source: "local",
				error,
				detail: "tools/call (id 7, tool searchDocs)",
			})
		})
	})

	test("formats local bridge errors with target and cause chain", () => {
		const error = new TypeError("fetch failed", {
			cause: new Error("connect ECONNREFUSED 127.0.0.1:8787"),
		})

		expect(
			formatBridgeError(
				{
					source: "local",
					error,
					detail: "tools/call (id 7, tool searchDocs)",
				},
				{ localTarget: "http://localhost:8787/mcp" },
			),
		).toBe(
			[
				"Local MCP: http://localhost:8787/mcp",
				"Message: tools/call (id 7, tool searchDocs)",
				"Error: fetch failed",
				"Cause: connect ECONNREFUSED 127.0.0.1:8787",
			].join("\n"),
		)
	})
})

interface MockHttpTransport extends LocalHttpTransport {
	started: boolean
	closed: boolean
	sent: JSONRPCMessage[]
}

function createMockHttpTransport(): MockHttpTransport {
	const transport: MockHttpTransport = {
		started: false,
		closed: false,
		sent: [],
		async start() {
			transport.started = true
		},
		async close() {
			transport.closed = true
		},
		async send(message: JSONRPCMessage) {
			transport.sent.push(message)
		},
		onmessage: undefined,
		onclose: undefined,
		onerror: undefined,
	}
	return transport
}

const SAMPLE_INIT_RESULT = {
	protocolVersion: "2025-11-25",
	capabilities: { tools: {} },
	serverInfo: { name: "mock-server", version: "0.0.0" },
}

function findHandshakeId(sent: JSONRPCMessage[]): string | number {
	const init = sent.find(
		(msg) => "method" in msg && msg.method === "initialize",
	)
	if (!init || !("id" in init) || init.id === undefined) {
		throw new Error("no initialize frame captured")
	}
	return init.id
}

describe("wrapLocalHttpTransport", () => {
	test("runs initialize + notifications/initialized handshake on start", async () => {
		const transport = createMockHttpTransport()
		const peer = wrapLocalHttpTransport(transport)
		const seenMessages: JSONRPCMessage[] = []
		peer.onMessage((message) => seenMessages.push(message))

		const startPromise = peer.start()
		await vi.waitFor(() => {
			expect(transport.sent).toHaveLength(1)
		})

		const handshakeId = findHandshakeId(transport.sent)
		transport.onmessage?.({
			jsonrpc: "2.0",
			id: handshakeId,
			result: SAMPLE_INIT_RESULT,
		})
		await startPromise

		expect(transport.sent).toEqual([
			expect.objectContaining({ method: "initialize", id: handshakeId }),
			{ jsonrpc: "2.0", method: "notifications/initialized" },
		])
		// Handshake response must not leak to bridge consumers.
		expect(seenMessages).toEqual([])
	})

	test("replies from cache when gateway forwards initialize and drops initialized notification", async () => {
		const transport = createMockHttpTransport()
		const peer = wrapLocalHttpTransport(transport)
		const seenMessages: JSONRPCMessage[] = []
		peer.onMessage((message) => seenMessages.push(message))

		const startPromise = peer.start()
		await vi.waitFor(() => {
			expect(transport.sent).toHaveLength(1)
		})
		const handshakeId = findHandshakeId(transport.sent)
		transport.onmessage?.({
			jsonrpc: "2.0",
			id: handshakeId,
			result: SAMPLE_INIT_RESULT,
		})
		await startPromise

		await peer.send({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-06-18",
				capabilities: {},
				clientInfo: { name: "gateway", version: "1" },
			},
		})
		await peer.send({
			jsonrpc: "2.0",
			method: "notifications/initialized",
		})

		// Neither gateway-forwarded frame reaches the local transport.
		expect(transport.sent).toEqual([
			expect.objectContaining({ method: "initialize", id: handshakeId }),
			{ jsonrpc: "2.0", method: "notifications/initialized" },
		])
		// Gateway's initialize is answered locally from the cache.
		expect(seenMessages).toEqual([
			{ jsonrpc: "2.0", id: 1, result: SAMPLE_INIT_RESULT },
		])
	})

	test("forwards non-handshake frames to the transport", async () => {
		const transport = createMockHttpTransport()
		const peer = wrapLocalHttpTransport(transport)

		const startPromise = peer.start()
		await vi.waitFor(() => {
			expect(transport.sent).toHaveLength(1)
		})
		const handshakeId = findHandshakeId(transport.sent)
		transport.onmessage?.({
			jsonrpc: "2.0",
			id: handshakeId,
			result: SAMPLE_INIT_RESULT,
		})
		await startPromise

		const toolsList: JSONRPCMessage = {
			jsonrpc: "2.0",
			id: 42,
			method: "tools/list",
		}
		await peer.send(toolsList)

		expect(transport.sent.at(-1)).toEqual(toolsList)
	})

	test("rejects start() when the local initialize errors", async () => {
		const transport = createMockHttpTransport()
		const peer = wrapLocalHttpTransport(transport)

		const startPromise = peer.start()
		await vi.waitFor(() => {
			expect(transport.sent).toHaveLength(1)
		})
		const handshakeId = findHandshakeId(transport.sent)
		transport.onmessage?.({
			jsonrpc: "2.0",
			id: handshakeId,
			error: { code: -32000, message: "boom" },
		})

		await expect(startPromise).rejects.toThrow(/Local MCP initialize failed/)
	})
})
