/// <reference types="jest" />

import { resolvePackage, fetchConnection } from "../registry"
import fetch from "node-fetch"

jest.mock("node-fetch", () => jest.fn())

jest.mock("../registry", () => ({
	resolvePackage: jest.fn(),
	fetchConnection: jest.requireActual("../registry").fetchConnection,
}))

describe("registry", () => {
	const mockWsServer = {
		qualifiedName: "test-ws-server",
		displayName: "Test WS Server",
		connections: [
			{
				type: "ws" as const,
				deploymentUrl: "ws://test.com",
				configSchema: {},
			},
		],
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	test("fetchConnection accesses well-known endpoint for websocket servers", async () => {
		// Mock resolvePackage to return the mock server
		;(resolvePackage as jest.Mock).mockResolvedValue(mockWsServer)

		// Mock fetch responses for both endpoints
		const mockFetch = fetch as unknown as jest.Mock
		mockFetch.mockImplementation((url: string) => {
			if (url === "ws://test.com/.well-known/mcp/smithery.json") {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							configSchema: { type: "object", properties: {} },
						}),
				})
			}
			if (url === "https://registry.smithery.ai/servers/test-ws-server") {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							success: true,
							result: {
								type: "ws",
								url: "ws://test.com",
								config: {},
							},
						}),
				})
			}
			return Promise.reject(new Error(`Unexpected URL: ${url}`))
		})

		await fetchConnection("test-ws-server", {})

		// Verify the well-known endpoint was called
		expect(mockFetch).toHaveBeenCalledWith(
			"ws://test.com/.well-known/mcp/smithery.json",
		)

		// Verify the registry endpoint was called
		expect(mockFetch).toHaveBeenCalledWith(
			"https://registry.smithery.ai/servers/test-ws-server",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					connectionType: "ws",
					config: {},
				}),
			}),
		)
	})
})
