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
	resolveEnvTemplates: vi.fn(),
	resolveTemplateString: vi.fn(),
}))

vi.mock("../../lib/registry", () => ({
	fetchConnection: vi.fn(),
}))

vi.mock("../../commands/run/runner-utils", () => ({
	logWithTimestamp: vi.fn(),
}))

import {
	ensureBundleInstalled,
	getBundleCommand,
	resolveEnvTemplates,
	resolveTemplateString,
} from "../../lib/bundle-manager"
import { fetchConnection } from "../../lib/registry"
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
		expect(fetchConnection).not.toHaveBeenCalled()
	})

	test("handles bundle connection with args template resolution", async () => {
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
		vi.mocked(getBundleCommand).mockReturnValue({
			command: "node",
			args: ["${__dirname}/index.js", "apiKey=${user_config.apiKey}"],
		})
		vi.mocked(resolveTemplateString)
			.mockReturnValueOnce(`${bundleDir}/index.js`)
			.mockReturnValueOnce("apiKey=saved-key")

		const result = await prepareStdioConnection(
			server,
			server.connections[0],
			userConfig,
		)

		expect(ensureBundleInstalled).toHaveBeenCalledWith(
			"author/bundle-server",
			"https://smithery.ai/bundles/author/bundle-server.mcpb",
		)
		expect(getBundleCommand).toHaveBeenCalledWith(bundleDir)

		expect(result).toEqual({
			command: "node",
			args: [`${bundleDir}/index.js`, "apiKey=saved-key"],
			env: {},
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

		const bundleDir =
			"/home/.smithery/cache/servers/author/bundle-server/current"

		vi.mocked(ensureBundleInstalled).mockResolvedValue(bundleDir)
		vi.mocked(getBundleCommand).mockReturnValue({
			command: "node",
			args: ["${__dirname}/index.js"],
		})
		vi.mocked(resolveTemplateString).mockReturnValue(`${bundleDir}/index.js`)

		const result = await prepareStdioConnection(server, server.connections[0], {
			DEBUG: "true",
		})

		expect(result.args).toEqual([`${bundleDir}/index.js`])
		expect(result.env).toEqual({})
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
			prepareStdioConnection(server, server.connections[0], { DEBUG: "true" }),
		).rejects.toThrow("Invalid connection configuration")
	})

	test("resolves args templates with runtime config overriding saved config", async () => {
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

		const bundleDir = "/cache/dir"

		vi.mocked(ensureBundleInstalled).mockResolvedValue(bundleDir)
		vi.mocked(getBundleCommand).mockReturnValue({
			command: "node",
			args: ["${__dirname}/index.js", "port=${user_config.port}"],
		})
		vi.mocked(resolveTemplateString)
			.mockReturnValueOnce(`${bundleDir}/index.js`)
			.mockReturnValueOnce("port=8080")

		const result = await prepareStdioConnection(server, server.connections[0], {
			port: 8080,
		} as any)

		// Runtime config (8080) is used directly
		expect(result.args).toEqual([`${bundleDir}/index.js`, "port=8080"])
		expect(result.env).toEqual({})
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

		const bundleDir =
			"/home/.smithery/cache/servers/author/bundle-server/current"
		vi.mocked(ensureBundleInstalled).mockResolvedValue(bundleDir)
		vi.mocked(getBundleCommand).mockReturnValue({
			command: "node",
			args: ["${__dirname}/index.js"],
		})
		vi.mocked(resolveTemplateString).mockReturnValue(`${bundleDir}/index.js`)

		await prepareStdioConnection(server, server.connections[0], {})

		expect(vi.mocked(ensureBundleInstalled)).toHaveBeenCalled()
		expect(bundleDir).toContain("/current")
	})

	test("resolves environment variable templates from bundle manifest", async () => {
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
		const userConfig = {
			apiKey: "secret-key-123",
			database: { host: "localhost", port: 5432 },
		}

		vi.mocked(ensureBundleInstalled).mockResolvedValue(bundleDir)
		vi.mocked(getBundleCommand).mockReturnValue({
			command: "node",
			args: ["${__dirname}/index.js"],
			env: {
				API_KEY: "${user_config.apiKey}",
				DATABASE_URL:
					"${user_config.database.host}:${user_config.database.port}",
			},
		})
		vi.mocked(resolveTemplateString).mockReturnValue(`${bundleDir}/index.js`)
		vi.mocked(resolveEnvTemplates).mockReturnValue({
			API_KEY: "secret-key-123",
			DATABASE_URL: "localhost:5432",
		})

		const result = await prepareStdioConnection(
			server,
			server.connections[0],
			userConfig,
		)

		expect(resolveEnvTemplates).toHaveBeenCalledWith(
			{
				API_KEY: "${user_config.apiKey}",
				DATABASE_URL:
					"${user_config.database.host}:${user_config.database.port}",
			},
			userConfig,
			bundleDir,
		)

		expect(result.env).toEqual({
			API_KEY: "secret-key-123",
			DATABASE_URL: "localhost:5432",
		})
	})
})

describe("prepareStdioConnection - Integration Tests with Real Resolution", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("resolves nested config in env vars (integration)", async () => {
		const { readFileSync } = await import("node:fs")
		const { join } = await import("node:path")

		const fixturesDir = join(__dirname, "fixtures")
		const manifest = JSON.parse(
			readFileSync(
				join(fixturesDir, "env-nested-config-manifest.json"),
				"utf-8",
			),
		)
		const userConfig = JSON.parse(
			readFileSync(join(fixturesDir, "env-nested-user-config.json"), "utf-8"),
		)

		const server: ServerDetailResponse = {
			qualifiedName: "test/env-nested",
			remote: false,
			connections: [
				{
					type: "stdio",
					bundleUrl: "https://example.com/bundle.mcpb",
					configSchema: {},
				},
			],
		} as unknown as ServerDetailResponse

		const bundleDir = "/test/bundle/dir"

		vi.mocked(ensureBundleInstalled).mockResolvedValue(bundleDir)
		vi.mocked(getBundleCommand).mockReturnValue({
			command: manifest.server.mcp_config.command,
			args: manifest.server.mcp_config.args,
			env: manifest.server.mcp_config.env,
		})

		const actualBundleManager = await vi.importActual<
			typeof import("../../lib/bundle-manager")
		>("../../lib/bundle-manager")

		vi.mocked(resolveTemplateString).mockImplementation(
			actualBundleManager.resolveTemplateString,
		)
		vi.mocked(resolveEnvTemplates).mockImplementation(
			actualBundleManager.resolveEnvTemplates,
		)

		const result = await prepareStdioConnection(
			server,
			server.connections[0],
			userConfig,
		)

		expect(result.command).toBe("node")
		expect(result.args).toEqual([`${bundleDir}/server.js`])
		expect(result.env).toEqual({
			API_KEY: "secret-key-123",
			DATABASE_URL: "localhost:5432",
			LOG_LEVEL: "debug",
		})
		expect(result.qualifiedName).toBe("test/env-nested")
	})

	test("resolves nested config in args (integration)", async () => {
		const { readFileSync } = await import("node:fs")
		const { join } = await import("node:path")

		const fixturesDir = join(__dirname, "fixtures")
		const manifest = JSON.parse(
			readFileSync(
				join(fixturesDir, "args-nested-config-manifest.json"),
				"utf-8",
			),
		)
		const userConfig = JSON.parse(
			readFileSync(join(fixturesDir, "args-nested-user-config.json"), "utf-8"),
		)

		const server: ServerDetailResponse = {
			qualifiedName: "test/args-nested",
			remote: false,
			connections: [
				{
					type: "stdio",
					bundleUrl: "https://example.com/bundle.mcpb",
					configSchema: {},
				},
			],
		} as unknown as ServerDetailResponse

		const bundleDir = "/test/bundle/dir"

		vi.mocked(ensureBundleInstalled).mockResolvedValue(bundleDir)
		vi.mocked(getBundleCommand).mockReturnValue({
			command: manifest.server.mcp_config.command,
			args: manifest.server.mcp_config.args,
			env: manifest.server.mcp_config.env,
		})

		const actualBundleManager = await vi.importActual<
			typeof import("../../lib/bundle-manager")
		>("../../lib/bundle-manager")

		vi.mocked(resolveTemplateString).mockImplementation(
			actualBundleManager.resolveTemplateString,
		)
		vi.mocked(resolveEnvTemplates).mockImplementation(
			actualBundleManager.resolveEnvTemplates,
		)

		const result = await prepareStdioConnection(
			server,
			server.connections[0],
			userConfig,
		)

		expect(result.command).toBe("node")
		expect(result.args).toEqual([
			`${bundleDir}/index.js`,
			"connectionString=postgresql://user:pass@localhost:5432/db",
			"role=admin",
			"apiKey=my-api-key",
		])
		expect(result.env).toEqual({})
		expect(result.qualifiedName).toBe("test/args-nested")
	})

	test("resolves nested config in both args and env (integration)", async () => {
		const { readFileSync } = await import("node:fs")
		const { join } = await import("node:path")

		const fixturesDir = join(__dirname, "fixtures")
		const manifest = JSON.parse(
			readFileSync(
				join(fixturesDir, "mixed-nested-config-manifest.json"),
				"utf-8",
			),
		)
		const userConfig = JSON.parse(
			readFileSync(join(fixturesDir, "mixed-nested-user-config.json"), "utf-8"),
		)

		const server: ServerDetailResponse = {
			qualifiedName: "test/mixed-nested",
			remote: false,
			connections: [
				{
					type: "stdio",
					bundleUrl: "https://example.com/bundle.mcpb",
					configSchema: {},
				},
			],
		} as unknown as ServerDetailResponse

		const bundleDir = "/test/bundle/dir"

		vi.mocked(ensureBundleInstalled).mockResolvedValue(bundleDir)
		vi.mocked(getBundleCommand).mockReturnValue({
			command: manifest.server.mcp_config.command,
			args: manifest.server.mcp_config.args,
			env: manifest.server.mcp_config.env,
		})

		const actualBundleManager = await vi.importActual<
			typeof import("../../lib/bundle-manager")
		>("../../lib/bundle-manager")

		vi.mocked(resolveTemplateString).mockImplementation(
			actualBundleManager.resolveTemplateString,
		)
		vi.mocked(resolveEnvTemplates).mockImplementation(
			actualBundleManager.resolveEnvTemplates,
		)

		const result = await prepareStdioConnection(
			server,
			server.connections[0],
			userConfig,
		)

		expect(result.command).toBe("node")
		expect(result.args).toEqual([
			`${bundleDir}/server.js`,
			"--port=8080",
			"--host=0.0.0.0",
		])
		expect(result.env).toEqual({
			API_KEY: "test-api-key-456",
			SECRET: "super-secret-value",
		})
		expect(result.qualifiedName).toBe("test/mixed-nested")
	})
})
