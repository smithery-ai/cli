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

	test("evaluates stdioFunction to get command and args", async () => {
		const server: Server = {
			qualifiedName: "author/stdio-function-server",
			remote: false,
			connections: [
				{
					type: "stdio",
					stdioFunction:
						"config => ({command: 'npx', args: ['-y', '@playwright/mcp@latest'] })",
					configSchema: {},
				},
			],
		} as unknown as Server

		const result = await prepareStdioConnection(
			server,
			server.connections[0] as StdioConnection,
			{ apiKey: "test-key" },
		)

		expect(result).toEqual({
			command: "npx",
			args: ["-y", "@playwright/mcp@latest"],
			env: {},
			qualifiedName: "author/stdio-function-server",
		})

		expect(ensureBundleInstalled).not.toHaveBeenCalled()
		expect(getHydratedBundleCommand).not.toHaveBeenCalled()
	})

	test("evaluates stdioFunction with env from config", async () => {
		const server: Server = {
			qualifiedName: "author/stdio-function-env-server",
			remote: false,
			connections: [
				{
					type: "stdio",
					stdioFunction:
						"config => ({command: 'node', args: ['server.js'], env: { API_KEY: config.apiKey } })",
					configSchema: {},
				},
			],
		} as unknown as Server

		const result = await prepareStdioConnection(
			server,
			server.connections[0] as StdioConnection,
			{ apiKey: "test-api-key" },
		)

		expect(result).toEqual({
			command: "node",
			args: ["server.js"],
			env: { API_KEY: "test-api-key" },
			qualifiedName: "author/stdio-function-env-server",
		})
	})

	test("throws error when stdioFunction returns invalid result", async () => {
		const server: Server = {
			qualifiedName: "author/invalid-stdio-function-server",
			remote: false,
			connections: [
				{
					type: "stdio",
					stdioFunction: "config => ({ invalid: 'result' })",
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
		).rejects.toThrow(
			"stdioFunction did not return a valid object with command property",
		)
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
