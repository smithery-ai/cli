/**
 * Unit tests for resolveTransport function
 */

import { beforeEach, describe, expect, test, vi } from "vitest"
import type { ClientDefinition } from "../../../config/clients"
import { resolveTransport } from "../transport"

// Mock getClientConfiguration
vi.mock("../../../config/clients", async () => {
	const actual = await vi.importActual("../../../config/clients")
	return {
		...actual,
		getClientConfiguration: vi.fn(),
	}
})

import { getClientConfiguration } from "../../../config/clients"

const mockGetClientConfiguration = vi.mocked(getClientConfiguration)

// Helper functions to create mock ClientDefinition objects
function mockClientWithOAuth(label: string): ClientDefinition {
	return {
		label,
		install: { method: "file", format: "json", path: "/tmp/test.json" },
		transports: { stdio: {}, http: { supportsOAuth: true } },
	}
}

function mockClientWithoutOAuth(label: string): ClientDefinition {
	return {
		label,
		install: { method: "file", format: "json", path: "/tmp/test.json" },
		transports: { stdio: {}, http: { supportsOAuth: false } },
	}
}

function mockStdioOnlyClient(label: string): ClientDefinition {
	return {
		label,
		install: { method: "file", format: "json", path: "/tmp/test.json" },
		transports: { stdio: {} },
	}
}

describe("resolveTransport", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("should return http-oauth when connection is HTTP and client supports OAuth", () => {
		// ARRANGE
		const connection = {
			type: "http" as const,
			configSchema: {},
			deploymentUrl: "https://example.com",
		}
		const client = "cursor"

		mockGetClientConfiguration.mockReturnValue(mockClientWithOAuth("Cursor"))

		// ACT
		const result = resolveTransport(connection, client)

		// ASSERT
		expect(result).toEqual({
			type: "http-oauth",
			needsUserConfig: false,
		})
	})

	test("should return http-proxy when connection is HTTP but client does not support OAuth", () => {
		// ARRANGE
		const connection = {
			type: "http" as const,
			configSchema: {},
			deploymentUrl: "https://example.com",
		}
		const client = "claude"

		mockGetClientConfiguration.mockReturnValue(
			mockClientWithoutOAuth("Claude Desktop"),
		)

		// ACT
		const result = resolveTransport(connection, client)

		// ASSERT
		expect(result).toEqual({
			type: "http-proxy",
			needsUserConfig: false,
		})
	})

	test("should return stdio when connection is STDIO", () => {
		// ARRANGE
		const connection = { type: "stdio" as const, configSchema: {} }
		const client = "claude"

		mockGetClientConfiguration.mockReturnValue(
			mockStdioOnlyClient("Claude Desktop"),
		)

		// ACT
		const result = resolveTransport(connection, client)

		// ASSERT
		expect(result).toEqual({
			type: "stdio",
			needsUserConfig: true,
		})
	})

	test("stdio transport should require user config", () => {
		// ARRANGE
		const connection = { type: "stdio" as const, configSchema: {} }
		const client = "cursor"

		mockGetClientConfiguration.mockReturnValue(mockClientWithOAuth("Cursor"))

		// ACT
		const result = resolveTransport(connection, client)

		// ASSERT
		expect(result.needsUserConfig).toBe(true)
	})

	test("http transport should not require user config", () => {
		// ARRANGE
		const connection = {
			type: "http" as const,
			configSchema: {},
			deploymentUrl: "https://example.com",
		}
		const client = "cursor"

		mockGetClientConfiguration.mockReturnValue(mockClientWithOAuth("Cursor"))

		// ACT
		const result = resolveTransport(connection, client)

		// ASSERT
		expect(result.needsUserConfig).toBe(false)
	})
})
