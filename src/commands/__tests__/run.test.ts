/**
 * Run Command Tests
 * Validates server resolution and proper runner invocation
 */

import { beforeEach, describe, expect, test, vi } from "vitest"
import {
	httpRemoteServer,
	stdioRegularServer,
	studioBundleServer,
} from "./fixtures/mock-servers"

// Mock the runners
vi.mock("../run/stdio-runner", () => ({
	createStdioRunner: vi.fn().mockResolvedValue(() => Promise.resolve()),
}))

// Mock registry
vi.mock("../../lib/registry", () => ({
	resolveServer: vi.fn(),
}))

// Mock prepareStdioConnection
vi.mock("../../utils/run/prepare-stdio-connection", () => ({
	prepareStdioConnection: vi.fn().mockResolvedValue({
		command: "node",
		args: ["server.js"],
		env: { PATH: "/usr/bin" },
		qualifiedName: "test/server",
	}),
}))

// Mock settings
vi.mock("../../utils/smithery-settings", () => ({
	initializeSettings: vi.fn().mockResolvedValue({ success: true }),
	getAnalyticsConsent: vi.fn().mockResolvedValue(false),
	getApiKey: vi.fn().mockResolvedValue("test-api-key"),
}))

// Mock keychain
vi.mock("../../lib/keychain", () => ({
	getConfig: vi.fn().mockResolvedValue(null),
}))

import { resolveServer } from "../../lib/registry"
import { prepareStdioConnection } from "../../utils/run/prepare-stdio-connection"
import { run } from "../run/index"
import { createStdioRunner } from "../run/stdio-runner"

describe("run command", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("HTTP remote server calls createStdioRunner with mcp-remote command", async () => {
		vi.mocked(resolveServer).mockResolvedValue({
			server: httpRemoteServer,
			connection: httpRemoteServer.connections[0],
		})

		await run("author/remote-server", {})

		// HTTP connections should be converted to STDIO using mcp-remote
		// No API key needed - OAuth servers track remotely
		expect(createStdioRunner).toHaveBeenCalledWith(
			process.platform === "win32" ? "cmd" : "npx",
			process.platform === "win32"
				? ["/c", "npx", "-y", "mcp-remote", "https://server.smithery.ai"]
				: ["-y", "mcp-remote", "https://server.smithery.ai"],
			{},
			"author/remote-server",
			undefined, // No API key needed - OAuth servers track remotely
		)
	})

	test("STDIO regular server calls createStdioRunner with prepared connection", async () => {
		vi.mocked(resolveServer).mockResolvedValue({
			server: stdioRegularServer,
			connection: stdioRegularServer.connections[0],
		})
		vi.mocked(prepareStdioConnection).mockResolvedValue({
			command: "npx",
			args: ["-y", "@author/mcp-server"],
			env: { PATH: "/usr/bin" },
			qualifiedName: "author/stdio-server",
		})

		await run("author/stdio-server", {})

		expect(prepareStdioConnection).toHaveBeenCalledWith(
			stdioRegularServer,
			stdioRegularServer.connections[0],
			{},
		)

		expect(createStdioRunner).toHaveBeenCalledWith(
			"npx",
			["-y", "@author/mcp-server"],
			{ PATH: "/usr/bin" },
			"author/stdio-server",
			"test-api-key",
		)
	})

	test("STDIO bundle server calls createStdioRunner with unpacked bundle", async () => {
		vi.mocked(resolveServer).mockResolvedValue({
			server: studioBundleServer,
			connection: studioBundleServer.connections[0],
		})
		vi.mocked(prepareStdioConnection).mockResolvedValue({
			command: "node",
			args: [
				"/home/.smithery/cache/servers/author/bundle-server/current/index.js",
			],
			env: { API_KEY: "test" },
			qualifiedName: "author/bundle-server",
		})

		await run("author/bundle-server", { API_KEY: "test" })

		expect(prepareStdioConnection).toHaveBeenCalledWith(
			studioBundleServer,
			studioBundleServer.connections[0],
			{ API_KEY: "test" },
		)

		expect(createStdioRunner).toHaveBeenCalledWith(
			"node",
			["/home/.smithery/cache/servers/author/bundle-server/current/index.js"],
			{ API_KEY: "test" },
			"author/bundle-server",
			"test-api-key",
		)
	})
})
