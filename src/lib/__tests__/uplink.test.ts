import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"
import { describe, expect, test, vi } from "vitest"
import { wireJsonRpcBridge } from "../uplink"

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

function createLocalPeer() {
	const listeners: {
		message?: (message: JSONRPCMessage) => void
		close?: (code?: number) => void
		error?: (error: unknown) => void
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
		onError(listener: (error: unknown) => void) {
			listeners.error = listener
			return undefined
		},
		async send(message: JSONRPCMessage) {
			this.sent.push(message)
		},
		emitMessage(message: JSONRPCMessage) {
			listeners.message?.(message)
		},
		emitClose(code?: number) {
			listeners.close?.(code)
		},
		emitError(error: unknown) {
			listeners.error?.(error)
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
})
