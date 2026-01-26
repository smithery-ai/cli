/**
 * Registry Library Unit Tests
 * Tests the qualified name parsing logic in resolveServer
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

vi.mock("cross-fetch", () => ({ default: vi.fn() }))
vi.mock("dotenv", () => ({ config: vi.fn() }))
vi.mock("../logger", () => ({ verbose: vi.fn() }))
vi.mock("../../utils/analytics", () => ({
	getSessionId: vi.fn(() => "test-session"),
}))
vi.mock("../../utils/smithery-settings", () => ({
	getUserId: vi.fn(async () => "test-user"),
}))

import { Smithery } from "@smithery/api"
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
				}) as unknown as ReturnType<typeof Smithery>,
		)
	})

	describe("qualified name parsing", () => {
		test('parses "linear" as namespace="linear", serverName=""', async () => {
			await resolveServer("linear")

			expect(mockGet).toHaveBeenCalledWith("", { namespace: "linear" })
		})

		test('parses "@foo/bar" as namespace="foo", serverName="bar"', async () => {
			await resolveServer("@foo/bar")

			expect(mockGet).toHaveBeenCalledWith("bar", { namespace: "foo" })
		})

		test('parses "@smithery/github" as namespace="smithery", serverName="github"', async () => {
			await resolveServer("@smithery/github")

			expect(mockGet).toHaveBeenCalledWith("github", { namespace: "smithery" })
		})

		test('parses "myorg" as namespace="myorg", serverName=""', async () => {
			await resolveServer("myorg")

			expect(mockGet).toHaveBeenCalledWith("", { namespace: "myorg" })
		})
	})

	describe("resolved server response", () => {
		test("returns server and first connection", async () => {
			const mockResponse = {
				qualifiedName: "@foo/bar",
				connections: [
					{ type: "stdio", command: "npx foo" },
					{ type: "http", url: "https://example.com" },
				],
			}
			mockGet.mockResolvedValue(mockResponse)

			const result = await resolveServer("@foo/bar")

			expect(result.server).toEqual(mockResponse)
			expect(result.connection).toEqual({ type: "stdio", command: "npx foo" })
		})

		test("throws when no connections available", async () => {
			mockGet.mockResolvedValue({
				qualifiedName: "@foo/bar",
				connections: [],
			})

			await expect(resolveServer("@foo/bar")).rejects.toThrow(
				"No connection configuration found for server",
			)
		})
	})
})
