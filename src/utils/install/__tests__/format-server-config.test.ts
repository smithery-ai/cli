/**
 * Unit tests for formatServerConfig function
 */

import { beforeEach, describe, expect, test, vi } from "vitest"
import { Transport } from "../../../config/clients"
import { determineConfigType, formatServerConfig } from "../server-config"
import { optionalOnlyServer } from "./fixtures/servers"

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

describe("formatServerConfig", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("should return http-oauth config when server is HTTP and client supports HTTP and OAuth", () => {
		// ARRANGE
		const qualifiedName = "@test/http-server"
		const client = "cursor"
		const server = optionalOnlyServer

		mockGetClientConfiguration.mockReturnValue({
			label: "Cursor",
			supportedTransports: [Transport.HTTP, Transport.STDIO],
			installType: "json",
			supportsOAuth: true,
			path: "/tmp/cursor.json",
		})

		// ACT
		const result = formatServerConfig(qualifiedName, client, server)

		// ASSERT
		expect(result).toEqual({
			type: "http",
			url: `https://server.smithery.ai/${qualifiedName}/mcp`,
			headers: {},
		})
	})

	test("should return http-no-oauth config when server is HTTP and client supports HTTP but not OAuth", () => {
		// ARRANGE
		const qualifiedName = "@test/http-server"
		const client = "claude"
		const server = optionalOnlyServer

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.HTTP, Transport.STDIO],
			installType: "json",
			supportsOAuth: false,
			path: "/tmp/claude.json",
		})

		// ACT
		const result = formatServerConfig(qualifiedName, client, server)

		// ASSERT
		expect(result).toEqual({
			command: "npx",
			args: [
				"-y",
				"mcp-remote",
				`https://server.smithery.ai/${qualifiedName}/mcp`,
			],
		})
	})

	test("should return stdio config when server is STDIO and client supports STDIO", () => {
		// ARRANGE
		const qualifiedName = "@test/stdio-server"
		const client = "claude"
		const server = {
			qualifiedName: "@test/stdio-server",
			remote: false,
			connections: [
				{
					type: "stdio",
					configSchema: {},
				},
			],
		} as typeof optionalOnlyServer

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.STDIO],
			installType: "json",
			path: "/tmp/claude.json",
		})

		// ACT
		const result = formatServerConfig(qualifiedName, client, server)

		// ASSERT
		expect(result).toEqual({
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", qualifiedName],
		})
	})
})

describe("determineConfigType", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("should return http-oauth when server has HTTP and client supports OAuth", () => {
		// ARRANGE
		const client = "cursor"
		const server = optionalOnlyServer

		mockGetClientConfiguration.mockReturnValue({
			label: "Cursor",
			supportedTransports: [Transport.HTTP, Transport.STDIO],
			installType: "json",
			supportsOAuth: true,
			path: "/tmp/cursor.json",
		})

		// ACT
		const result = determineConfigType(client, server)

		// ASSERT
		expect(result).toBe("http-oauth")
	})

	test("should return http-no-oauth when server has HTTP but client does not support OAuth", () => {
		// ARRANGE
		const client = "claude-desktop"
		const server = optionalOnlyServer

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.HTTP, Transport.STDIO],
			installType: "json",
			supportsOAuth: false,
			path: "/tmp/claude.json",
		})

		// ACT
		const result = determineConfigType(client, server)

		// ASSERT
		expect(result).toBe("http-no-oauth")
	})

	test("should return stdio when server only has STDIO connection", () => {
		// ARRANGE
		const client = "claude"
		const server = {
			qualifiedName: "@test/stdio-server",
			remote: false,
			connections: [
				{
					type: "stdio",
					configSchema: {},
				},
			],
		} as typeof optionalOnlyServer

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.STDIO],
			installType: "json",
			path: "/tmp/claude.json",
		})

		// ACT
		const result = determineConfigType(client, server)

		// ASSERT
		expect(result).toBe("stdio")
	})
})
