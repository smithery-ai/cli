import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"
import { afterEach, describe, expect, test, vi } from "vitest"
import {
	buildHttpPairUrl,
	buildPairUrl,
	formatBridgeError,
	getUplinkBaseUrl,
	getUplinkPairingEndpoint,
	type LocalPeer,
	preflightUplinkPair,
	type SocketPeer,
	wireJsonRpcBridge,
	wrapInitialized,
} from "../uplink"

declare global {
	var __SMITHERY_VERSION__: string
}
globalThis.__SMITHERY_VERSION__ = globalThis.__SMITHERY_VERSION__ ?? "test"

const ORIGINAL_UPLINK_BASE_URL = process.env.SMITHERY_UPLINK_BASE_URL
const ORIGINAL_MCP_BASE_URL = process.env.SMITHERY_MCP_BASE_URL
const ORIGINAL_BASE_URL = process.env.SMITHERY_BASE_URL

afterEach(() => {
	if (ORIGINAL_UPLINK_BASE_URL === undefined) {
		delete process.env.SMITHERY_UPLINK_BASE_URL
	} else {
		process.env.SMITHERY_UPLINK_BASE_URL = ORIGINAL_UPLINK_BASE_URL
	}

	if (ORIGINAL_MCP_BASE_URL === undefined) {
		delete process.env.SMITHERY_MCP_BASE_URL
	} else {
		process.env.SMITHERY_MCP_BASE_URL = ORIGINAL_MCP_BASE_URL
	}

	if (ORIGINAL_BASE_URL === undefined) {
		delete process.env.SMITHERY_BASE_URL
	} else {
		process.env.SMITHERY_BASE_URL = ORIGINAL_BASE_URL
	}

	vi.unstubAllGlobals()
})

interface MockSocketPeer extends SocketPeer {
	sent: string[]
	emitMessage(data: string | ArrayBuffer): void
	emitClose(event: { code: number; reason: string }): void
	emitError(error: unknown): void
}

function createSocketPeer(): MockSocketPeer {
	const peer: MockSocketPeer = {
		sent: [],
		send(text) {
			peer.sent.push(text)
		},
		emitMessage(data) {
			peer.onmessage?.(data)
		},
		emitClose(event) {
			peer.onclose?.(event)
		},
		emitError(error) {
			peer.onerror?.(error)
		},
	}
	return peer
}

interface MockLocalPeer extends LocalPeer {
	sent: JSONRPCMessage[]
	emitMessage(message: JSONRPCMessage): void
	emitClose(code?: number): void
	emitError(error: unknown, detail?: string): void
}

function createLocalPeer(options?: {
	send?: (message: JSONRPCMessage) => Promise<void>
}): MockLocalPeer {
	const peer: MockLocalPeer = {
		sent: [],
		async start() {},
		async close() {},
		async send(message) {
			peer.sent.push(message)
			await options?.send?.(message)
		},
		emitMessage(message) {
			peer.onmessage?.(message)
		},
		emitClose(code) {
			peer.onclose?.(code)
		},
		emitError(error, detail) {
			peer.onerror?.({ error, detail })
		},
	}
	return peer
}

describe("uplink pairing urls", () => {
	test("builds direct websocket pair urls", () => {
		expect(buildPairUrl("https://uplink.smithery.run", "ns", "conn")).toBe(
			"wss://uplink.smithery.run/ns/conn",
		)
		expect(buildPairUrl("https://uplink.smithery.run", "ns", "team/conn")).toBe(
			"wss://uplink.smithery.run/ns/team/conn",
		)
		expect(
			buildPairUrl(
				"https://uplink.smithery.run",
				"team a",
				"local/server b",
				true,
			),
		).toBe("wss://uplink.smithery.run/team%20a/local/server%20b?force=1")
		expect(buildPairUrl("http://localhost:8787", "ns", "conn")).toBe(
			"ws://localhost:8787/ns/conn/uplink",
		)
		expect(
			buildPairUrl("https://uplink.smithery.run", "team/a", "conn b"),
		).toBe("wss://uplink.smithery.run/team%2Fa/conn%20b")
		expect(buildPairUrl("https://uplink.smithery.run", "ns", "team/a?b")).toBe(
			"wss://uplink.smithery.run/ns/team/a%3Fb",
		)
		expect(
			buildPairUrl(
				"https://fwd-connect-f44e-dev.smithery.tools",
				"ns",
				"conn",
				true,
			),
		).toBe("wss://fwd-connect-f44e-dev.smithery.tools/ns/conn/uplink?force=1")
		expect(
			buildPairUrl("https://fwd-uplink-f44e-dev.smithery.tools", "ns", "conn"),
		).toBe("wss://fwd-uplink-f44e-dev.smithery.tools/ns/conn")
	})

	test("builds direct http preflight urls", () => {
		expect(
			buildHttpPairUrl("https://uplink.smithery.run", "ns", "team/conn"),
		).toBe("https://uplink.smithery.run/ns/team/conn")
		expect(
			buildHttpPairUrl("https://uplink.smithery.run", "team a", "local b"),
		).toBe("https://uplink.smithery.run/team%20a/local%20b")
		expect(
			buildHttpPairUrl(
				"https://fwd-connect-f44e-dev.smithery.tools",
				"ns",
				"team/conn",
			),
		).toBe("https://fwd-connect-f44e-dev.smithery.tools/ns/team/conn/uplink")
	})

	test("resolves the uplink base independently from the api base", () => {
		delete process.env.SMITHERY_UPLINK_BASE_URL
		delete process.env.SMITHERY_MCP_BASE_URL
		delete process.env.SMITHERY_BASE_URL
		expect(getUplinkBaseUrl()).toBe("https://uplink.smithery.run")

		process.env.SMITHERY_UPLINK_BASE_URL = "http://localhost:8787"
		expect(getUplinkBaseUrl()).toBe("http://localhost:8787")
		expect(getUplinkPairingEndpoint()).toEqual({
			baseURL: "http://localhost:8787",
			routeStyle: "connect-compat",
		})

		delete process.env.SMITHERY_UPLINK_BASE_URL
		process.env.SMITHERY_MCP_BASE_URL =
			"https://fwd-connect-f44e-dev.smithery.tools"
		expect(getUplinkBaseUrl()).toBe(
			"https://fwd-connect-f44e-dev.smithery.tools",
		)
		expect(getUplinkPairingEndpoint()).toEqual({
			baseURL: "https://fwd-connect-f44e-dev.smithery.tools",
			routeStyle: "connect-compat",
		})

		delete process.env.SMITHERY_MCP_BASE_URL
		process.env.SMITHERY_BASE_URL = "http://127.0.0.1:8789/api"
		expect(getUplinkBaseUrl()).toBe("http://127.0.0.1:8789")
		expect(getUplinkPairingEndpoint()).toEqual({
			baseURL: "http://127.0.0.1:8789",
			routeStyle: "connect-compat",
		})

		process.env.SMITHERY_BASE_URL =
			"https://fwd-connect-f44e-dev.smithery.tools"
		expect(getUplinkPairingEndpoint()).toEqual({
			baseURL: "https://fwd-connect-f44e-dev.smithery.tools",
			routeStyle: "connect-compat",
		})

		process.env.SMITHERY_BASE_URL = "https://api.smithery.ai"
		expect(getUplinkBaseUrl()).toBe("https://uplink.smithery.run")
	})
})

describe("preflightUplinkPair", () => {
	test("uses the direct uplink host and treats 503 as available", async () => {
		const fetchMock = vi.fn(async () => new Response(null, { status: 503 }))
		vi.stubGlobal("fetch", fetchMock)

		await expect(
			preflightUplinkPair({
				baseURL: "https://uplink.smithery.run",
				apiKey: "key",
				namespace: "ns",
				connectionId: "team/conn",
			}),
		).resolves.toBe("disconnected")

		expect(fetchMock).toHaveBeenCalledWith(
			"https://uplink.smithery.run/ns/team/conn",
			{ headers: { Authorization: "Bearer key" } },
		)
	})

	test("treats 200 as already paired", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 200 })),
		)

		await expect(
			preflightUplinkPair({
				baseURL: "https://uplink.smithery.run",
				apiKey: "key",
				namespace: "ns",
				connectionId: "conn",
			}),
		).resolves.toBe("paired")
	})

	test.each([
		[401, "smithery login"],
		[403, "connections:write"],
		[404, "Connection not found"],
		[409, "Uplink already paired. Use --force to take over."],
	])("formats %i errors", async (status, message) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status })),
		)

		await expect(
			preflightUplinkPair({
				baseURL: "https://uplink.smithery.run",
				apiKey: "key",
				namespace: "ns",
				connectionId: "conn",
			}),
		).rejects.toThrow(message)
	})
})

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
			detail: undefined,
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

	test("dispose detaches handlers from both peers", () => {
		const socket = createSocketPeer()
		const local = createLocalPeer()
		const onClose = vi.fn()
		const onError = vi.fn()

		const dispose = wireJsonRpcBridge({ socket, local, onClose, onError })
		dispose()

		socket.emitClose({ code: 1000, reason: "" })
		local.emitClose(0)
		socket.emitError(new Error("boom"))
		local.emitError(new Error("boom"))

		expect(onClose).not.toHaveBeenCalled()
		expect(onError).not.toHaveBeenCalled()
	})
})

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

describe("wrapInitialized", () => {
	test("runs initialize + notifications/initialized handshake on start", async () => {
		const inner = createLocalPeer()
		const peer = wrapInitialized(inner)
		const seenMessages: JSONRPCMessage[] = []
		peer.onmessage = (message) => seenMessages.push(message)

		const startPromise = peer.start()
		await vi.waitFor(() => {
			expect(inner.sent).toHaveLength(1)
		})

		const handshakeId = findHandshakeId(inner.sent)
		inner.emitMessage({
			jsonrpc: "2.0",
			id: handshakeId,
			result: SAMPLE_INIT_RESULT,
		})
		await startPromise

		expect(inner.sent).toEqual([
			expect.objectContaining({ method: "initialize", id: handshakeId }),
			{ jsonrpc: "2.0", method: "notifications/initialized" },
		])
		// Handshake response must not leak to bridge consumers.
		expect(seenMessages).toEqual([])
	})

	test("replies from cache when gateway forwards initialize and drops initialized notification", async () => {
		const inner = createLocalPeer()
		const peer = wrapInitialized(inner)
		const seenMessages: JSONRPCMessage[] = []
		peer.onmessage = (message) => seenMessages.push(message)

		const startPromise = peer.start()
		await vi.waitFor(() => {
			expect(inner.sent).toHaveLength(1)
		})
		const handshakeId = findHandshakeId(inner.sent)
		inner.emitMessage({
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

		// Neither gateway-forwarded frame reaches the inner peer.
		expect(inner.sent).toEqual([
			expect.objectContaining({ method: "initialize", id: handshakeId }),
			{ jsonrpc: "2.0", method: "notifications/initialized" },
		])
		// Gateway's initialize is answered locally from the cache.
		expect(seenMessages).toEqual([
			{ jsonrpc: "2.0", id: 1, result: SAMPLE_INIT_RESULT },
		])
	})

	test("forwards non-handshake frames to the inner peer", async () => {
		const inner = createLocalPeer()
		const peer = wrapInitialized(inner)

		const startPromise = peer.start()
		await vi.waitFor(() => {
			expect(inner.sent).toHaveLength(1)
		})
		const handshakeId = findHandshakeId(inner.sent)
		inner.emitMessage({
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

		expect(inner.sent.at(-1)).toEqual(toolsList)
	})

	test("rejects start() when the local initialize errors", async () => {
		const inner = createLocalPeer()
		const peer = wrapInitialized(inner)

		const startPromise = peer.start()
		await vi.waitFor(() => {
			expect(inner.sent).toHaveLength(1)
		})
		const handshakeId = findHandshakeId(inner.sent)
		inner.emitMessage({
			jsonrpc: "2.0",
			id: handshakeId,
			error: { code: -32000, message: "boom" },
		})

		await expect(startPromise).rejects.toThrow(/Local MCP initialize failed/)
	})

	test("rejects start() when the inner peer closes before initialize resolves", async () => {
		const inner = createLocalPeer()
		const peer = wrapInitialized(inner)

		const startPromise = peer.start()
		await vi.waitFor(() => {
			expect(inner.sent).toHaveLength(1)
		})

		inner.emitClose(1)

		await expect(startPromise).rejects.toThrow(
			/closed before initialize completed/i,
		)
	})
})
