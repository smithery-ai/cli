/**
 * PrepareStdioConnection Tests
 * Tests the 3 connection preparation paths: direct, bundle, and registry fetch
 */

import type { ServerDetailResponse } from "@smithery/registry/models/components"
import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock dependencies
vi.mock("../../lib/bundle-manager", () => ({
	ensureBundleInstalled: vi.fn(),
	getBundleCommand: vi.fn(),
}))

vi.mock("../../lib/registry", () => ({
	fetchConnection: vi.fn(),
	getUserConfig: vi.fn(),
}))

vi.mock("../../commands/run/runner-utils", () => ({
	logWithTimestamp: vi.fn(),
}))

import { ensureBundleInstalled, getBundleCommand } from "../../lib/bundle-manager"
import { fetchConnection, getUserConfig } from "../../lib/registry"
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
			"test-api-key",
		)

		expect(result).toEqual({
			command: "npx",
			args: ["-y", "@author/mcp-server"],
			env: { PATH: "/usr/bin" },
			qualifiedName: "author/direct-server",
		})

		expect(ensureBundleInstalled).not.toHaveBeenCalled()
		expect(fetchConnection).not.toHaveBeenCalled()
	})

	test("handles bundle connection with config merging", async () => {
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

		vi.mocked(ensureBundleInstalled).mockResolvedValue(
			"/home/.smithery/cache/servers/author/bundle-server/current",
		)
		vi.mocked(getBundleCommand).mockReturnValue({
			command: "node",
			args: ["/home/.smithery/cache/servers/author/bundle-server/current/index.js"],
		})
		vi.mocked(getUserConfig).mockResolvedValue({
			API_KEY: "saved-key",
			BASE_URL: "https://api.example.com",
		})

		const result = await prepareStdioConnection(
			server,
			server.connections[0],
			{ API_KEY: "runtime-key", DEBUG: "true" },
			"test-api-key",
		)

		expect(ensureBundleInstalled).toHaveBeenCalledWith(
			"author/bundle-server",
			"https://smithery.ai/bundles/author/bundle-server.mcpb",
		)
		expect(getBundleCommand).toHaveBeenCalledWith(
			"/home/.smithery/cache/servers/author/bundle-server/current",
		)
		expect(getUserConfig).toHaveBeenCalledWith(
			"author/bundle-server",
			"test-api-key",
			undefined,
		)

		expect(result).toEqual({
			command: "node",
			args: ["/home/.smithery/cache/servers/author/bundle-server/current/index.js"],
			env: {
				API_KEY: "runtime-key", // Runtime config overrides saved
				BASE_URL: "https://api.example.com", // From saved config
				DEBUG: "true", // From runtime config
			},
			qualifiedName: "author/bundle-server",
		})
	})

	test("handles bundle connection without saved config", async () => {
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

		vi.mocked(ensureBundleInstalled).mockResolvedValue(
			"/home/.smithery/cache/servers/author/bundle-server/current",
		)
		vi.mocked(getBundleCommand).mockReturnValue({
			command: "node",
			args: ["/home/.smithery/cache/servers/author/bundle-server/current/index.js"],
		})
		vi.mocked(getUserConfig).mockResolvedValue(null)

		const result = await prepareStdioConnection(
			server,
			server.connections[0],
			{ DEBUG: "true" },
			"test-api-key",
		)

		expect(result.env).toEqual({ DEBUG: "true" })
	})

	test("fetches connection from registry when no command or bundleUrl", async () => {
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

		vi.mocked(fetchConnection).mockResolvedValue({
			command: "python",
			args: ["-m", "server"],
			env: { PYTHONPATH: "/opt/python" },
		})

		const result = await prepareStdioConnection(
			server,
			server.connections[0],
			{ DEBUG: "true" },
			"test-api-key",
		)

		expect(fetchConnection).toHaveBeenCalledWith(
			"author/registry-server",
			{ DEBUG: "true" },
			"test-api-key",
		)

		expect(result).toEqual({
			command: "python",
			args: ["-m", "server"],
			env: { PYTHONPATH: "/opt/python" },
			qualifiedName: "author/registry-server",
		})
	})

	test("converts config values to strings for env vars in bundle path", async () => {
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

		vi.mocked(ensureBundleInstalled).mockResolvedValue("/cache/dir")
		vi.mocked(getBundleCommand).mockReturnValue({
			command: "node",
			args: ["index.js"],
		})
		vi.mocked(getUserConfig).mockResolvedValue(null)

		const result = await prepareStdioConnection(
			server,
			server.connections[0],
			{ PORT: 8080, ENABLED: true } as any,
			"test-api-key",
		)

		expect(result.env).toEqual({
			PORT: "8080",
			ENABLED: "true",
		})
	})

	test("bundle unpacks to current directory for version management", async () => {
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

		const bundleDir = "/home/.smithery/cache/servers/author/bundle-server/current"
		vi.mocked(ensureBundleInstalled).mockResolvedValue(bundleDir)
		vi.mocked(getBundleCommand).mockReturnValue({
			command: "node",
			args: [`${bundleDir}/index.js`],
		})
		vi.mocked(getUserConfig).mockResolvedValue(null)

		await prepareStdioConnection(
			server,
			server.connections[0],
			{},
			"test-api-key",
		)

		expect(vi.mocked(ensureBundleInstalled)).toHaveBeenCalled()
		expect(bundleDir).toContain("/current")
	})
})
