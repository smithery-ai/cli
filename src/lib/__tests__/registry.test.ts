/**
 * Registry Library Unit Tests
 * Tests resolveServer behavior (parsing logic is tested in qualified-name.test.ts)
 */

import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock dependencies
vi.mock("@smithery/api", () => ({
	Smithery: vi.fn(() => ({
		servers: {
			get: vi.fn(),
		},
	})),
	APIConnectionTimeoutError: class extends Error {},
	AuthenticationError: class extends Error {},
}))

vi.mock("dotenv", () => ({ config: vi.fn() }))
vi.mock("../logger", () => ({ verbose: vi.fn() }))
vi.mock("../../utils/analytics", () => ({
	getSessionId: vi.fn(() => "test-session"),
}))
vi.mock("../../utils/smithery-settings", () => ({
	getUserId: vi.fn(async () => "test-user"),
}))

import { Smithery } from "@smithery/api"
import { parseQualifiedName } from "../../utils/cli-utils"
import { resolveServer } from "../registry"

describe("resolveServer", () => {
	let mockGet: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup mock server response
		mockGet = vi.fn().mockResolvedValue({
			qualifiedName: "test-server",
			connections: [{ type: "stdio", command: "test" }],
		})

		vi.mocked(Smithery).mockImplementation(
			() =>
				({
					servers: {
						get: mockGet,
					},
				}) as unknown as InstanceType<typeof Smithery>,
		)
	})

	test("calls SDK with namespace and serverName", async () => {
		await resolveServer(parseQualifiedName("@foo/bar"))

		expect(mockGet).toHaveBeenCalledWith("bar", { namespace: "foo" })
	})

	test("returns server and first connection", async () => {
		const mockResponse = {
			qualifiedName: "@foo/bar",
			connections: [
				{ type: "stdio", command: "npx foo" },
				{ type: "http", url: "https://example.com" },
			],
		}
		mockGet.mockResolvedValue(mockResponse)

		const result = await resolveServer(parseQualifiedName("@foo/bar"))

		expect(result.server).toEqual(mockResponse)
		expect(result.connection).toEqual({ type: "stdio", command: "npx foo" })
	})

	test("throws when no connections available", async () => {
		mockGet.mockResolvedValue({
			qualifiedName: "@foo/bar",
			connections: [],
		})

		await expect(resolveServer(parseQualifiedName("@foo/bar"))).rejects.toThrow(
			"No connection configuration found for server",
		)
	})

	test("creates Smithery client with empty API key when env var not set", async () => {
		delete process.env.SMITHERY_API_KEY

		await resolveServer(parseQualifiedName("@foo/bar"))

		// Verify Smithery was instantiated with empty string API key
		expect(Smithery).toHaveBeenCalledWith(
			expect.objectContaining({ apiKey: "" }),
		)
	})

	test("creates Smithery client with API key from env when available", async () => {
		process.env.SMITHERY_API_KEY = "test-api-key"

		await resolveServer(parseQualifiedName("@foo/bar"))

		expect(Smithery).toHaveBeenCalledWith(
			expect.objectContaining({ apiKey: "test-api-key" }),
		)

		delete process.env.SMITHERY_API_KEY
	})
})

describe("searchServers", () => {
	let mockList: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()

		mockList = vi.fn().mockResolvedValue({
			servers: [
				{
					qualifiedName: "test/server",
					displayName: "Test Server",
					description: "A test server",
					useCount: 100,
					verified: true,
				},
			],
		})

		vi.mocked(Smithery).mockImplementation(
			() =>
				({
					servers: {
						get: vi.fn(),
						list: mockList,
					},
				}) as unknown as InstanceType<typeof Smithery>,
		)
	})

	test("creates Smithery client with empty API key when not provided", async () => {
		const { searchServers } = await import("../registry")

		await searchServers("test")

		expect(Smithery).toHaveBeenCalledWith(
			expect.objectContaining({ apiKey: "" }),
		)
	})

	test("creates Smithery client with provided API key", async () => {
		const { searchServers } = await import("../registry")

		await searchServers("test", "custom-api-key")

		expect(Smithery).toHaveBeenCalledWith(
			expect.objectContaining({ apiKey: "custom-api-key" }),
		)
	})

	test("returns formatted server results", async () => {
		const { searchServers } = await import("../registry")

		const results = await searchServers("test")

		expect(results).toHaveLength(1)
		expect(results[0]).toEqual({
			qualifiedName: "test/server",
			displayName: "Test Server",
			description: "A test server",
			useCount: 100,
			verified: true,
		})
	})
})
