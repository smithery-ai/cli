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

		expect(post).toHaveBeenCalledWith("/calclavia", {
			body: {
				name: "local-dev",
				transport: "uplink",
			},
			defaultBaseURL: "https://smithery.run",
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

		expect(put).toHaveBeenCalledWith("/calclavia/local-dev", {
			body: {
				transport: "uplink",
			},
			defaultBaseURL: "https://smithery.run",
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

		expect(del).toHaveBeenCalledWith("/calclavia/remote-http", {
			defaultBaseURL: "https://smithery.run",
		})
		expect(put).toHaveBeenNthCalledWith(2, "/calclavia/remote-http", {
			body: {
				mcpUrl: "https://server.smithery.ai/exa",
			},
			defaultBaseURL: "https://smithery.run",
		})
	})

	test("lists tools over smithery.run REST", async () => {
		const get = vi.fn().mockResolvedValue({
			tools: [
				{
					name: "repo.search",
					description: "Search repos",
					inputSchema: { type: "object" },
				},
			],
		})
		const session = new ConnectSession({ get } as never, "calclavia")

		const tools = await session.listToolsForConnection({
			connectionId: "github",
			name: "GitHub",
		} as never)

		expect(get).toHaveBeenCalledWith("/calclavia/github/.tools", {
			defaultBaseURL: "https://smithery.run",
		})
		expect(tools).toEqual([
			{
				connectionId: "github",
				connectionName: "GitHub",
				name: "repo.search",
				description: "Search repos",
				inputSchema: { type: "object" },
			},
		])
	})

	test("calls dotted tools through hierarchical REST paths", async () => {
		const get = vi.fn().mockResolvedValue({
			connectionId: "github",
			name: "GitHub",
			status: { state: "connected" },
		})
		const post = vi.fn().mockResolvedValue({
			content: [{ type: "text", text: "ok" }],
		})
		const session = new ConnectSession({ get, post } as never, "calclavia")

		await session.callTool("github", "repo.search", { query: "mcp" })

		expect(get).toHaveBeenCalledWith("/calclavia/github", {
			defaultBaseURL: "https://smithery.run",
		})
		expect(post).toHaveBeenCalledWith("/calclavia/github/.tools/repo/search", {
			body: { query: "mcp" },
			defaultBaseURL: "https://smithery.run",
		})
	})
})
