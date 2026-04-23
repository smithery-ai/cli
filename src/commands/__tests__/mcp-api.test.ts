import { ConflictError } from "@smithery/api"
import { describe, expect, test, vi } from "vitest"
import { ConnectSession } from "../mcp/api"

describe("ConnectSession uplink compatibility", () => {
	test("creates uplink connections without an mcpUrl", async () => {
		const post = vi.fn().mockResolvedValue({
			connectionId: "local-dev",
			name: "local-dev",
			mcpUrl: null,
			transport: "uplink",
			metadata: null,
			status: { state: "disconnected" },
		})

		const session = new ConnectSession({ post } as never, "calclavia")
		await session.createConnection(undefined, {
			name: "local-dev",
			transport: "uplink",
		})

		expect(post).toHaveBeenCalledWith("/connect/calclavia", {
			body: {
				name: "local-dev",
				transport: "uplink",
			},
		})
	})

	test("does not replace conflicting uplink connections on 409", async () => {
		const conflict = new ConflictError(409, {}, undefined, new Headers())
		const put = vi.fn().mockRejectedValueOnce(conflict)
		const del = vi.fn().mockResolvedValue({ success: true })

		const session = new ConnectSession(
			{ put, delete: del } as never,
			"calclavia",
		)
		await expect(
			session.setConnection("local-dev", undefined, {
				transport: "uplink",
			}),
		).rejects.toBe(conflict)

		expect(put).toHaveBeenCalledWith("/connect/calclavia/local-dev", {
			body: {
				transport: "uplink",
			},
		})
		expect(del).not.toHaveBeenCalled()
	})

	test("retries conflicting http set requests after deleting the connection", async () => {
		const put = vi
			.fn()
			.mockRejectedValueOnce(
				new ConflictError(409, {}, undefined, new Headers()),
			)
			.mockResolvedValueOnce({
				connectionId: "remote-http",
				name: "remote-http",
				mcpUrl: "https://server.smithery.ai/exa",
				metadata: null,
				status: { state: "connected" },
			})
		const del = vi.fn().mockResolvedValue({ success: true })

		const session = new ConnectSession(
			{ put, delete: del } as never,
			"calclavia",
		)
		await session.setConnection("remote-http", "https://server.smithery.ai/exa")

		expect(del).toHaveBeenCalledWith("/connect/calclavia/remote-http")
		expect(put).toHaveBeenNthCalledWith(2, "/connect/calclavia/remote-http", {
			body: {
				mcpUrl: "https://server.smithery.ai/exa",
			},
		})
	})
})
