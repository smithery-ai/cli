/**
 * PrepareStdioConnection Tests
 * Tests the 2 connection preparation paths: direct and bundle
 */

import type { ServerDetailResponse } from "@smithery/registry/models/components"
import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock dependencies
vi.mock("../../../lib/mcpb", () => ({
	ensureBundleInstalled: vi.fn(),
	getHydratedBundleCommand: vi.fn(),
}))

vi.mock("../../../commands/run/runner-utils", () => ({
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
		const server: ServerDetailResponse = {
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
		} as unknown as ServerDetailResponse

		const result = await prepareStdioConnection(
			server,
			server.connections[0],
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

	test("calls ensureBundleInstalled and getHydratedBundleCommand for bundle connections", async () => {
		const server: ServerDetailResponse = {
			qualifiedName: "author/bundle-server",
			remote: false,
			connections: [
				{
					type: "stdio",
					bundleUrl: "https://smithery.ai/bundles/author/bundle-server.mcpb",
					configSchema: {},
				},
			],
		} as unknown as ServerDetailResponse

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
			server.connections[0],
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

	test("throws error when no command or bundleUrl", async () => {
		const server: ServerDetailResponse = {
			qualifiedName: "author/registry-server",
			remote: false,
			connections: [
				{
					type: "stdio",
					configSchema: {},
				},
			],
		} as unknown as ServerDetailResponse

		await expect(
			prepareStdioConnection(server, server.connections[0], {}),
		).rejects.toThrow("Invalid connection configuration")
	})
})
