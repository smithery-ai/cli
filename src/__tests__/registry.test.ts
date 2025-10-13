/**
 * Registry API Tests
 * 
 * Tests that registry functions make correct API calls with:
 * - Proper URL encoding
 * - Correct endpoints
 * - Profile support
 * - Error handling
 */

import { beforeEach, describe, expect, test, vi } from "vitest"
import {
	getUserConfig,
	saveUserConfig,
	searchServers,
	validateUserConfig,
} from "../lib/registry"

// Mock fetchWithTimeout
const mockFetchWithTimeout = vi.fn()
vi.mock("../utils/fetch", () => ({
	fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}))

// Mock logger
vi.mock("../lib/logger", () => ({
	verbose: vi.fn(),
}))

// Mock smithery config
vi.mock("../utils/smithery-config", () => ({
	getUserId: vi.fn().mockResolvedValue("test-user-id"),
}))

describe("Registry API", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("validateUserConfig", () => {
		test("should use correct endpoint with URL encoding", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					isComplete: true,
					hasExistingConfig: true,
					missingFields: [],
					fieldSchemas: {},
				}),
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			await validateUserConfig("@ref-tools/ref-tools-mcp", "test-api-key")

			// Verify exact endpoint path
			const callUrl = mockFetchWithTimeout.mock.calls[0][0] as string
			expect(callUrl).toContain("/config/%40ref-tools%2Fref-tools-mcp/validate")
			expect(callUrl).not.toContain("/config/validate/%40ref-tools") // Wrong pattern
			
			expect(mockFetchWithTimeout).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					method: "GET",
					headers: {
						Authorization: "Bearer test-api-key",
						"Content-Type": "application/json",
					},
				}),
			)
		})

		test("should include profile as query parameter", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					isComplete: false,
					hasExistingConfig: false,
					missingFields: ["apiKey"],
					fieldSchemas: {},
				}),
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			await validateUserConfig("@test/server", "test-api-key", "my-profile-123")

			expect(mockFetchWithTimeout).toHaveBeenCalledWith(
				expect.stringContaining("profile=my-profile-123"),
				expect.any(Object),
			)
		})

		test("should handle validation errors", async () => {
			const mockResponse = {
				ok: false,
				statusText: "Not Found",
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			await expect(
				validateUserConfig("@test/nonexistent", "test-api-key"),
			).rejects.toThrow("Config validation failed: Not Found")
		})
	})

	describe("getUserConfig", () => {
		test("should use correct endpoint with URL encoding", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue({
					config: { apiKey: "saved-key" },
				}),
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			await getUserConfig("@ref-tools/ref-tools-mcp", "test-api-key")

			expect(mockFetchWithTimeout).toHaveBeenCalledWith(
				expect.stringContaining("/config/@ref-tools/ref-tools-mcp"),
				expect.objectContaining({
					method: "GET",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer test-api-key",
					},
				}),
			)
		})

		test("should include profile as query parameter", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue({
					config: { apiKey: "saved-key" },
				}),
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			await getUserConfig("@test/server", "test-api-key", "work-profile")

			expect(mockFetchWithTimeout).toHaveBeenCalledWith(
				expect.stringContaining("profile=work-profile"),
				expect.any(Object),
			)
		})

		test("should return null for 404 responses", async () => {
			const mockResponse = {
				ok: false,
				status: 404,
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			const result = await getUserConfig("@test/server", "test-api-key")

			expect(result).toBeNull()
		})

		test("should throw error for other non-ok responses", async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				text: vi.fn().mockResolvedValue("Internal server error"),
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			await expect(
				getUserConfig("@test/server", "test-api-key"),
			).rejects.toThrow()
		})
	})

	describe("saveUserConfig", () => {
		test("should use correct endpoint with URL encoding", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue({
					success: true,
					message: "Configuration saved successfully",
				}),
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			await saveUserConfig(
				"@ref-tools/ref-tools-mcp",
				{ refApiKey: "test-key" },
				"test-api-key",
			)

			expect(mockFetchWithTimeout).toHaveBeenCalledWith(
				expect.stringContaining("/config/%40ref-tools%2Fref-tools-mcp"),
				expect.objectContaining({
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer test-api-key",
					},
					body: JSON.stringify({ config: { refApiKey: "test-key" } }),
				}),
			)
		})

		test("should include profile as query parameter", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue({
					success: true,
					message: "Configuration saved successfully",
				}),
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			await saveUserConfig(
				"@test/server",
				{ apiKey: "key" },
				"test-api-key",
				"team-profile",
			)

			expect(mockFetchWithTimeout).toHaveBeenCalledWith(
				expect.stringContaining("profile=team-profile"),
				expect.any(Object),
			)
		})

		test("should handle save errors", async () => {
			const mockResponse = {
				ok: false,
				status: 400,
				text: vi.fn().mockResolvedValue("Invalid configuration"),
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			await expect(
				saveUserConfig("@test/server", { invalid: true }, "test-api-key"),
			).rejects.toThrow()
		})
	})

	describe("searchServers", () => {
		test("should use correct endpoint with encoded search term", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					servers: [
						{
							qualifiedName: "@test/server",
							displayName: "Test Server",
							description: "A test server",
							useCount: 42,
						},
					],
				}),
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			await searchServers("weather api", "test-api-key")

			expect(mockFetchWithTimeout).toHaveBeenCalledWith(
				expect.stringContaining("/servers?q=weather%20api&pageSize=10"),
				expect.objectContaining({
					headers: {
						Authorization: "Bearer test-api-key",
						"Content-Type": "application/json",
					},
				}),
			)
		})

		test("should handle search with special characters", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({ servers: [] }),
			}
			mockFetchWithTimeout.mockResolvedValue(mockResponse)

			await searchServers("@smithery/test", "test-api-key")

			expect(mockFetchWithTimeout).toHaveBeenCalledWith(
				expect.stringContaining("q=%40smithery%2Ftest"),
				expect.any(Object),
			)
		})
	})

})

