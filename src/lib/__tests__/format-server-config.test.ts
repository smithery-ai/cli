/**
 * Unit tests for formatServerConfig function
 *
 * Tests the pure function with real-world examples:
 * - Real server fixtures (STDIO, HTTP, remote, local)
 * - Real client names (claude, claude-code, cursor)
 * - Assert expected output configurations
 */

import { beforeEach, describe, expect, test, vi } from "vitest"
import { Transport } from "../../config/clients"
import {
	noConfigServer,
	optionalOnlyServer,
	requiredOnlyServer,
} from "../../__tests__/fixtures/servers"
import { formatServerConfig } from "../../utils/session-config"

// Mock getPreferredTransport and getClientConfiguration
vi.mock("../../config/clients", async () => {
	const actual = await vi.importActual("../../config/clients")
	return {
		...actual,
		getClientConfiguration: vi.fn(),
		getPreferredTransport: vi.fn(),
	}
})

// Import after mocking
import {
	getClientConfiguration,
	getPreferredTransport,
} from "../../config/clients"

const mockGetClientConfiguration = vi.mocked(getClientConfiguration)
const mockGetPreferredTransport = vi.mocked(getPreferredTransport)

describe("formatServerConfig", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("STDIO servers", () => {
		test("should return STDIO config for local STDIO server with claude client", () => {
			// ARRANGE: Local STDIO server, STDIO-only client
			const qualifiedName = "@test/no-config-server"
			const client = "claude"
			const server = noConfigServer

			mockGetClientConfiguration.mockReturnValue({
				label: "Claude Desktop",
				supportedTransports: [Transport.STDIO],
				installType: "json",
				path: "/tmp/claude.json",
			})

			// ACT
			const result = formatServerConfig(qualifiedName, client, server)

			// ASSERT: Should return STDIO config
			expect(result).toEqual({
				command: "npx",
				args: ["-y", "@smithery/cli@latest", "run", qualifiedName],
			})
			expect("type" in result).toBe(false) // Not HTTP config
		})

		test("should return STDIO config for local STDIO server without client", () => {
			// ARRANGE: Local STDIO server, no client specified
			const qualifiedName = "@test/no-config-server"
			const server = noConfigServer

			// ACT
			const result = formatServerConfig(qualifiedName, undefined, server)

			// ASSERT: Should default to STDIO config
			expect(result).toEqual({
				command: "npx",
				args: ["-y", "@smithery/cli@latest", "run", qualifiedName],
			})
		})
	})

	describe("HTTP servers", () => {
		test("should return HTTP config for remote HTTP server with HTTP-preferring client", () => {
			// ARRANGE: Remote HTTP server, HTTP-preferring client (claude-code)
			const qualifiedName = "@test/optional-only-server"
			const client = "claude-code"
			const server = optionalOnlyServer

			mockGetClientConfiguration.mockReturnValue({
				label: "Claude Code",
				supportedTransports: [Transport.HTTP, Transport.STDIO],
				installType: "command",
				preferHTTP: true,
				command: "claude",
				supportsOAuth: true,
			})
			mockGetPreferredTransport.mockReturnValue(Transport.HTTP)

			// ACT
			const result = formatServerConfig(qualifiedName, client, server)

			// ASSERT: Should return HTTP config
			expect(result).toEqual({
				type: "http",
				url: `https://server.smithery.ai/${qualifiedName}/mcp`,
				headers: {},
			})
		})

		test("should return STDIO config for remote HTTP server with STDIO-only client", () => {
			// ARRANGE: Remote HTTP server, STDIO-only client (claude)
			const qualifiedName = "@test/required-only-server"
			const client = "claude"
			const server = requiredOnlyServer

			mockGetClientConfiguration.mockReturnValue({
				label: "Claude Desktop",
				supportedTransports: [Transport.STDIO],
				installType: "json",
				path: "/tmp/claude.json",
			})
			mockGetPreferredTransport.mockReturnValue(Transport.STDIO)

			// ACT
			const result = formatServerConfig(qualifiedName, client, server)

			// ASSERT: Should fallback to STDIO config (client doesn't support HTTP)
			expect(result).toEqual({
				command: "npx",
				args: ["-y", "@smithery/cli@latest", "run", qualifiedName],
			})
		})

		test("should return STDIO config for remote HTTP server without client", () => {
			// ARRANGE: Remote HTTP server, no client specified
			const qualifiedName = "@test/optional-only-server"
			const server = optionalOnlyServer

			// ACT
			const result = formatServerConfig(qualifiedName, undefined, server)

			// ASSERT: Should default to STDIO config
			expect(result).toEqual({
				command: "npx",
				args: ["-y", "@smithery/cli@latest", "run", qualifiedName],
			})
		})

		test("should return STDIO config for local HTTP server (not remote)", () => {
			// ARRANGE: Local HTTP server (should not use HTTP format)
			const qualifiedName = "@test/local-http-server"
			const client = "claude-code"
			const server = {
				...optionalOnlyServer,
				remote: false, // Not remote
			}

			mockGetClientConfiguration.mockReturnValue({
				label: "Claude Code",
				supportedTransports: [Transport.HTTP, Transport.STDIO],
				installType: "command",
				preferHTTP: true,
				command: "claude",
			})

			// ACT
			const result = formatServerConfig(qualifiedName, client, server)

			// ASSERT: Should use STDIO (local servers don't use HTTP format)
			expect(result).toEqual({
				command: "npx",
				args: ["-y", "@smithery/cli@latest", "run", qualifiedName],
			})
		})
	})

	describe("Qualified name handling", () => {
		test("should include exact qualified name in STDIO args", () => {
			// ARRANGE
			const qualifiedName = "@wonderwhy-er/desktop-commander"
			const server = noConfigServer

			// ACT
			const result = formatServerConfig(qualifiedName, undefined, server)

			// ASSERT: Qualified name preserved in args
			expect(result).toEqual({
				command: "npx",
				args: ["-y", "@smithery/cli@latest", "run", qualifiedName],
			})
		})

		test("should include exact qualified name in HTTP URL", () => {
			// ARRANGE
			const qualifiedName = "@upstash/context7-mcp"
			const client = "claude-code"
			const server = optionalOnlyServer

			mockGetClientConfiguration.mockReturnValue({
				label: "Claude Code",
				supportedTransports: [Transport.HTTP, Transport.STDIO],
				installType: "command",
				preferHTTP: true,
				command: "claude",
			})
			mockGetPreferredTransport.mockReturnValue(Transport.HTTP)

			// ACT
			const result = formatServerConfig(qualifiedName, client, server)

			// ASSERT: Qualified name in URL
			expect(result).toEqual({
				type: "http",
				url: `https://server.smithery.ai/${qualifiedName}/mcp`,
				headers: {},
			})
		})
	})
})
