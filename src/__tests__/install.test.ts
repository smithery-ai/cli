/**
 * Install Server Tests
 *
 * Tests the installServer function's side effects:
 * - Input: (qualifiedName, client, configValues) + current config state
 * - Side effects: writes merged config to file or executes command
 *
 * This test is server-type agnostic - it focuses on config merging logic.
 * Server-type specifics (HTTP vs STDIO, command vs bundle) are tested
 * separately in formatServerConfig and resolveServer unit tests.
 */

import type { ServerDetailResponse } from "@smithery/registry/models/components"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { ClientConfiguration } from "../config/clients"
import type { ConfiguredServer } from "../types/registry"
import { initialConfigs } from "./fixtures/configurations"

// Mock all the dependencies using factory functions
vi.mock("../utils/mcp-config", () => ({
	writeConfig: vi.fn(),
	runConfigCommand: vi.fn(),
	readConfig: vi.fn(),
}))

vi.mock("../lib/registry", () => ({
	resolveServer: vi.fn(),
	getUserConfig: vi.fn(),
	saveUserConfig: vi.fn(),
	validateUserConfig: vi.fn(),
}))

vi.mock("../lib/keychain", () => ({
	getConfig: vi.fn().mockResolvedValue(null),
	saveConfig: vi.fn(),
	deleteConfig: vi.fn(),
}))

vi.mock("../lib/user-config", () => ({
	resolveUserConfig: vi.fn().mockResolvedValue({}),
}))

vi.mock("../utils/session-config", () => ({
	collectConfigValues: vi.fn(),
	formatServerConfig: vi.fn(),
	getServerName: vi.fn(),
}))

vi.mock("../config/clients", () => ({
	getClientConfiguration: vi.fn(),
	Transport: { STDIO: "stdio", HTTP: "http" },
}))

vi.mock("../utils/analytics", () => ({
	checkAnalyticsConsent: vi.fn(),
}))

vi.mock("../utils/runtime", () => ({
	ensureUVInstalled: vi.fn(),
	ensureBunInstalled: vi.fn(),
	ensureApiKey: vi.fn().mockResolvedValue("test-api-key"),
	isRemote: vi.fn(),
	checkAndNotifyRemoteServer: vi.fn(),
}))

vi.mock("../utils/client", () => ({
	promptForRestart: vi.fn(),
}))

// Mock process.exit to prevent tests from exiting
vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

// Import after mocking
import { installServer } from "../commands/install"
import { getClientConfiguration } from "../config/clients"
import { resolveServer } from "../lib/registry"
import { readConfig, runConfigCommand, writeConfig } from "../utils/mcp-config"
import {
	collectConfigValues,
	formatServerConfig,
	getServerName,
} from "../utils/session-config"

// Get mocked functions
const mockWriteConfig = vi.mocked(writeConfig)
const mockRunConfigCommand = vi.mocked(runConfigCommand)
const mockReadConfig = vi.mocked(readConfig)
const mockResolveServer = vi.mocked(resolveServer)
const _mockCollectConfigValues = vi.mocked(collectConfigValues)
const mockFormatServerConfig = vi.mocked(formatServerConfig)
const mockGetServerName = vi.mocked(getServerName)
const mockGetClientConfiguration = vi.mocked(getClientConfiguration)

// Mock server response (server-type agnostic - just needs to exist)
const mockServer: ServerDetailResponse = {
	qualifiedName: "test-server",
	remote: false,
	connections: [
		{ type: "stdio", command: "npx", args: ["test-server"], configSchema: {} },
	],
} as unknown as ServerDetailResponse

// Simple mock server config (server-type agnostic)
const mockServerConfig: ConfiguredServer = {
	command: "npx",
	args: ["-y", "@smithery/cli@latest", "run", "test-server"],
}

// Test client configurations (only need one per installType since they share code paths)
const TEST_CLIENT_CONFIGS: Record<string, ClientConfiguration> = {
	fileBased: {
		label: "File-based Client",
		supportedTransports: [],
		installType: "json", // json/yaml/toml all use same code path
		path: "/tmp/test-client.json",
	},
	command: {
		label: "Command Client",
		supportedTransports: [],
		installType: "command",
		command: "test-cli",
		commandConfig: {
			stdio: (name: string) => ["--add-server", name],
		},
	},
}

describe("Install Server Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()

		// Default mock setup (server-type agnostic)
		mockResolveServer.mockResolvedValue({
			server: mockServer,
			connection: mockServer.connections[0],
		})
		mockFormatServerConfig.mockReturnValue(mockServerConfig)
		mockGetServerName.mockReturnValue("test-server")
	})

	describe("File-based clients (json, yaml, toml)", () => {
		test("should merge server into empty config", async () => {
			// ARRANGE: Empty initial config
			const initialConfig = initialConfigs.empty
			mockReadConfig.mockReturnValue(initialConfig)
			mockGetClientConfiguration.mockReturnValue(TEST_CLIENT_CONFIGS.fileBased)

			// ACT: Install server
			await installServer("test-server", "json", {})

			// ASSERT: Config written with new server merged
			expect(mockWriteConfig).toHaveBeenCalledWith(
				{
					mcpServers: {
						"test-server": mockServerConfig,
					},
				},
				"json",
			)
			expect(mockRunConfigCommand).not.toHaveBeenCalled()
		})

		test("should preserve existing servers when adding new server", async () => {
			// ARRANGE: Config with existing servers
			const initialConfig = initialConfigs.withMultipleServers
			mockReadConfig.mockReturnValue(initialConfig)
			mockGetClientConfiguration.mockReturnValue(TEST_CLIENT_CONFIGS.fileBased)

			// ACT: Install new server
			await installServer("test-server", "json", {})

			// ASSERT: All existing servers preserved, new server added
			expect(mockWriteConfig).toHaveBeenCalledWith(
				{
					mcpServers: {
						...initialConfig.mcpServers,
						"test-server": mockServerConfig,
					},
				},
				"json",
			)
		})

		test("should overwrite existing server with same name", async () => {
			// ARRANGE: Config with conflicting server name
			const initialConfig = initialConfigs.withConflictingServer
			mockReadConfig.mockReturnValue(initialConfig)
			mockGetClientConfiguration.mockReturnValue(TEST_CLIENT_CONFIGS.fileBased)

			// ACT: Install server with same name
			await installServer("test-server", "json", {})

			// ASSERT: Old server overwritten with new config
			expect(mockWriteConfig).toHaveBeenCalledWith(
				{
					mcpServers: {
						"test-server": mockServerConfig, // New config, old one replaced
					},
				},
				"json",
			)
		})
	})

	describe("Command-based clients", () => {
		test("should execute command instead of writing file", async () => {
			// ARRANGE: Empty initial config (command clients don't read config)
			mockReadConfig.mockReturnValue(initialConfigs.empty)
			mockGetClientConfiguration.mockReturnValue(TEST_CLIENT_CONFIGS.command)

			// ACT: Install server
			await installServer("test-server", "command", {})

			// ASSERT: Command executed with server config (not file written)
			expect(mockRunConfigCommand).toHaveBeenCalledWith(
				{
					mcpServers: {
						"test-server": mockServerConfig,
					},
				},
				TEST_CLIENT_CONFIGS.command,
			)
			expect(mockWriteConfig).not.toHaveBeenCalled()
		})
	})
})
