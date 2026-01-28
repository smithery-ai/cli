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
})
