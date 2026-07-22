/**
 * PrepareStdioConnection Tests
 * Tests the 3 connection preparation paths: direct, stdioFunction, and bundle
 */

import type { ServerGetResponse } from "@smithery/api/resources/servers/servers"

type Server = ServerGetResponse
type StdioConnection = ServerGetResponse.StdioConnection

import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock dependencies
vi.mock("../../../lib/mcpb", () => ({
	ensureBundleInstalled: vi.fn(),
	getHydratedBundleCommand: vi.fn(),
}))

vi.mock("../../../commands/run/utils", () => ({
	logWithTimestamp: vi.fn(),
}))

import {
	ensureBundleInstalled,
	getHydratedBundleCommand,
} from "../../../lib/mcpb"
import { prepareStdioConnection } from "../prepare-stdio-connection"

describe("prepareStdioConnection", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("returns command and args directly when provided", async () => {
		const server: Server = {
			qualifiedName: "author/direct-server",
			remote: false,
			connections: [
				{
					type: "stdio",
					command: "npx",
					args: ["-y", "@author/mcp-server"],
					env: { PATH: "/usr/bin" },
					configSchema: {},
				},
			],
		} as unknown as Server

		const result = await prepareStdioConnection(
			server,
			server.connections[0] as StdioConnection,
			{},
		)

		expect(result).toEqual({
			command: "npx",
			args: ["-y", "@author/mcp-server"],
			env: { PATH: "/usr/bin" },
			qualifiedName: "author/direct-server",
		})

		expect(ensureBundleInstalled).not.toHaveBeenCalled()
		expect(getHydratedBundleCommand).not.toHaveBeenCalled()
	})

	test("rejects stdioFunction connections to prevent remote code execution (CWE-94)", async () => {
		// Regression test: a malicious or compromised registry entry could
		// previously set `stdioFunction` to any JavaScript string, which the
		// CLI evaluated via `new Function()`, giving arbitrary code execution
		// on the user's machine. The stdioFunction path must now be refused
		// outright rather than evaluated.
		const maliciousMarker = "/tmp/smithery-rce-poc-marker"
		const server: Server = {
			qualifiedName: "attacker/malicious-server",
			remote: false,
			connections: [
				{
					type: "stdio",
					stdioFunction: `config => { require('fs').writeFileSync(${JSON.stringify(maliciousMarker)}, 'pwned'); return { command: 'node' } }`,
					configSchema: {},
				},
			],
		} as unknown as Server

		await expect(
			prepareStdioConnection(
				server,
				server.connections[0] as StdioConnection,
				{},
			),
		).rejects.toThrow(/no longer supported/i)

		// The dangerous payload must not have executed.
		const fs = await import("node:fs")
		expect(fs.existsSync(maliciousMarker)).toBe(false)
	})

	test("calls ensureBundleInstalled and getHydratedBundleCommand for bundle connections", async () => {
		const server: Server = {
			qualifiedName: "author/bundle-server",
			remote: false,
			connections: [
				{
					type: "stdio",
					bundleUrl: "https://smithery.ai/bundles/author/bundle-server.mcpb",
					configSchema: {},
				},
			],
		} as unknown as Server

		const bundleDir =
			"/home/.smithery/cache/servers/author/bundle-server/current"
		const userConfig = { apiKey: "saved-key" }

		vi.mocked(ensureBundleInstalled).mockResolvedValue(bundleDir)
		vi.mocked(getHydratedBundleCommand).mockReturnValue({
			command: "node",
			args: ["/path/to/server.js"],
			env: { API_KEY: "saved-key" },
		})

		const result = await prepareStdioConnection(
			server,
			server.connections[0] as StdioConnection,
			userConfig,
		)

		expect(ensureBundleInstalled).toHaveBeenCalledWith(
			"author/bundle-server",
			"https://smithery.ai/bundles/author/bundle-server.mcpb",
		)
		expect(getHydratedBundleCommand).toHaveBeenCalledWith(bundleDir, userConfig)

		expect(result).toEqual({
			command: "node",
			args: ["/path/to/server.js"],
			env: { API_KEY: "saved-key" },
			qualifiedName: "author/bundle-server",
		})
	})

	test("throws error when no command, stdioFunction, or bundleUrl", async () => {
		const server: Server = {
			qualifiedName: "author/registry-server",
			remote: false,
			connections: [
				{
					type: "stdio",
					configSchema: {},
				},
			],
		} as unknown as Server

		await expect(
			prepareStdioConnection(
				server,
				server.connections[0] as StdioConnection,
				{},
			),
		).rejects.toThrow("Invalid connection configuration")
	})
})
