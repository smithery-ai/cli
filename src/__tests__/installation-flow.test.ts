/**
 * Installation Flow Tests
 *
 * Tests the complete installation flow including:
 * - Validation of existing config
 * - Prompting for missing/optional config
 * - Saving config to registry
 * - User decisions (update, skip optional, etc.)
 */

import { beforeEach, describe, expect, test, vi } from "vitest"
import { installServer } from "../commands/install"
import { getClientConfiguration, Transport } from "../config/clients"
import { getConfig, saveConfig } from "../lib/keychain"
import { resolveServer } from "../lib/registry"
import { resolveUserConfig } from "../lib/user-config"
import { readConfig, writeConfig } from "../utils/mcp-config"
import {
	collectConfigValues,
	formatServerConfig,
	getServerName,
} from "../utils/session-config"
import { collectedConfigs, savedConfigs } from "./fixtures/configurations"
import {
	noConfigServer,
	optionalOnlyServer,
	requiredAndOptionalServer,
	requiredOnlyServer,
} from "./fixtures/servers"

// Mock all dependencies
vi.mock("../utils/mcp-config")
vi.mock("../lib/registry")
vi.mock("../lib/keychain")
vi.mock("../lib/user-config")
vi.mock("../utils/session-config")
vi.mock("../config/clients")
vi.mock("../utils/analytics", () => ({ checkAnalyticsConsent: vi.fn() }))
vi.mock("../utils/runtime", () => ({
	ensureUVInstalled: vi.fn(),
	ensureBunInstalled: vi.fn(),
	ensureApiKey: vi.fn().mockResolvedValue("test-api-key"),
	isRemote: vi.fn().mockReturnValue(true),
	checkAndNotifyRemoteServer: vi.fn(),
}))
vi.mock("../utils/client", () => ({ promptForRestart: vi.fn() }))
vi.mock("../utils/command-prompts", () => ({
	promptForExistingConfig: vi.fn().mockResolvedValue(true),
}))
vi.mock("inquirer", () => ({
	default: {
		prompt: vi.fn().mockResolvedValue({ updateConfig: false }),
	},
}))

// Mock process.exit
vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

// Get mocked functions
const mockGetConfig = vi.mocked(getConfig)
const mockSaveConfig = vi.mocked(saveConfig)
const mockResolveUserConfig = vi.mocked(resolveUserConfig)
const mockCollectConfigValues = vi.mocked(collectConfigValues)
const mockResolveServer = vi.mocked(resolveServer)
const mockGetServerName = vi.mocked(getServerName)
const mockFormatServerConfig = vi.mocked(formatServerConfig)
const mockGetClientConfiguration = vi.mocked(getClientConfiguration)
const mockReadConfig = vi.mocked(readConfig)
const mockWriteConfig = vi.mocked(writeConfig)

// Test client config
const testClientConfig = {
	label: "Test Client",
	supportedTransports: [Transport.HTTP],
	installType: "json" as const,
	path: "/tmp/test.json",
	supportsOAuth: true,
}

describe("Installation Flow", () => {
	beforeEach(() => {
		vi.clearAllMocks()

		// Default setup
		mockGetClientConfiguration.mockReturnValue(testClientConfig)
		mockGetServerName.mockReturnValue("test-server")
		mockReadConfig.mockReturnValue({ mcpServers: {} })
		mockFormatServerConfig.mockReturnValue({
			type: "http",
			url: "https://test.com",
			headers: {},
		})
	})

	describe("1. No Config Server", () => {
		test("should skip all prompts when no config needed", async () => {
			mockResolveServer.mockResolvedValue({
				server: noConfigServer,
				connection: noConfigServer.connections[0],
			})
			mockResolveUserConfig.mockResolvedValue({})

			await installServer("@test/no-config-server", "test-client", {})

			// Should resolve user config (returns empty for no config)
			expect(mockResolveUserConfig).toHaveBeenCalled()

			// Should NOT prompt for config
			expect(mockCollectConfigValues).not.toHaveBeenCalled()

			// Should NOT save config (empty config)
			expect(mockSaveConfig).not.toHaveBeenCalled()

			// Should write to client config
			expect(mockWriteConfig).toHaveBeenCalled()
		})
	})

	describe("2. Optional Only Server", () => {
		test("fresh install: should ask about optional config", async () => {
			mockResolveServer.mockResolvedValue({
				server: optionalOnlyServer,
				connection: optionalOnlyServer.connections[0],
			})
			mockGetConfig.mockResolvedValue(null) // No existing config
			mockResolveUserConfig.mockResolvedValue(collectedConfigs.optionalOnly)

			await installServer("@test/optional-only-server", "test-client", {})

			// Should resolve user config (which will prompt)
			expect(mockResolveUserConfig).toHaveBeenCalled()
			expect(mockSaveConfig).toHaveBeenCalledWith(
				"@test/optional-only-server",
				collectedConfigs.optionalOnly,
			)
		})

		test("complete config: should use existing config without prompting", async () => {
			mockResolveServer.mockResolvedValue({
				server: optionalOnlyServer,
				connection: optionalOnlyServer.connections[0],
			})
			mockGetConfig.mockResolvedValue(savedConfigs.optionalOnly)
			mockResolveUserConfig.mockResolvedValue(savedConfigs.optionalOnly!)

			await installServer("@test/optional-only-server", "test-client", {})

			// Should resolve user config (uses existing)
			expect(mockResolveUserConfig).toHaveBeenCalled()
			// Should NOT prompt for config (use existing)
			expect(mockCollectConfigValues).not.toHaveBeenCalled()
		})
	})

	describe("3. Required Only Server", () => {
		test("fresh install: should prompt for required config", async () => {
			mockResolveServer.mockResolvedValue({
				server: requiredOnlyServer,
				connection: requiredOnlyServer.connections[0],
			})
			mockGetConfig.mockResolvedValue(null) // No existing config
			mockResolveUserConfig.mockResolvedValue(collectedConfigs.requiredOnly)

			await installServer("@test/required-only-server", "test-client", {})

			// Should resolve user config (which will prompt)
			expect(mockResolveUserConfig).toHaveBeenCalled()
			expect(mockSaveConfig).toHaveBeenCalledWith(
				"@test/required-only-server",
				collectedConfigs.requiredOnly,
			)
		})

		test("partial config: should prompt for missing required fields", async () => {
			mockResolveServer.mockResolvedValue({
				server: requiredOnlyServer,
				connection: requiredOnlyServer.connections[0],
			})
			mockGetConfig.mockResolvedValue(savedConfigs.requiredOnlyPartial)
			mockResolveUserConfig.mockResolvedValue(collectedConfigs.requiredOnly)

			await installServer("@test/required-only-server", "test-client", {})

			// Should resolve user config (which will prompt for missing)
			expect(mockResolveUserConfig).toHaveBeenCalled()
		})

		test("complete config: should use existing config without prompting", async () => {
			mockResolveServer.mockResolvedValue({
				server: requiredOnlyServer,
				connection: requiredOnlyServer.connections[0],
			})
			mockGetConfig.mockResolvedValue(savedConfigs.requiredOnly)
			mockResolveUserConfig.mockResolvedValue(savedConfigs.requiredOnly!)

			await installServer("@test/required-only-server", "test-client", {})

			// Should resolve user config (uses existing)
			expect(mockResolveUserConfig).toHaveBeenCalled()
			// Should NOT prompt for config (use existing)
			expect(mockCollectConfigValues).not.toHaveBeenCalled()
		})
	})

	describe("4. Required + Optional Server", () => {
		test("fresh install: should prompt for required, then ask about optional", async () => {
			mockResolveServer.mockResolvedValue({
				server: requiredAndOptionalServer,
				connection: requiredAndOptionalServer.connections[0],
			})
			mockGetConfig.mockResolvedValue(null) // No existing config
			mockResolveUserConfig.mockResolvedValue(
				collectedConfigs.requiredAndOptional,
			)

			await installServer(
				"@test/required-and-optional-server",
				"test-client",
				{},
			)

			// Should resolve user config (which will prompt)
			expect(mockResolveUserConfig).toHaveBeenCalled()
			expect(mockSaveConfig).toHaveBeenCalledWith(
				"@test/required-and-optional-server",
				collectedConfigs.requiredAndOptional,
			)
		})

		test("partial config: should prompt for missing required", async () => {
			mockResolveServer.mockResolvedValue({
				server: requiredAndOptionalServer,
				connection: requiredAndOptionalServer.connections[0],
			})
			mockGetConfig.mockResolvedValue(savedConfigs.requiredAndOptionalPartial)
			mockResolveUserConfig.mockResolvedValue(
				collectedConfigs.requiredAndOptional,
			)

			await installServer(
				"@test/required-and-optional-server",
				"test-client",
				{},
			)

			// Should resolve user config (which will prompt for missing)
			expect(mockResolveUserConfig).toHaveBeenCalled()
		})

		test("complete config: should use existing config without prompting", async () => {
			mockResolveServer.mockResolvedValue({
				server: requiredAndOptionalServer,
				connection: requiredAndOptionalServer.connections[0],
			})
			mockGetConfig.mockResolvedValue(savedConfigs.requiredAndOptional)
			mockResolveUserConfig.mockResolvedValue(savedConfigs.requiredAndOptional!)

			await installServer(
				"@test/required-and-optional-server",
				"test-client",
				{},
			)

			// Should resolve user config (uses existing)
			expect(mockResolveUserConfig).toHaveBeenCalled()
			// Should NOT prompt for config (use existing)
			expect(mockCollectConfigValues).not.toHaveBeenCalled()
		})
	})

	describe("Profile Support", () => {
		test("should pass profile to validation and save", async () => {
			mockResolveServer.mockResolvedValue({
				server: requiredOnlyServer,
				connection: requiredOnlyServer.connections[0],
			})
			mockGetConfig.mockResolvedValue(null)
			mockResolveUserConfig.mockResolvedValue(collectedConfigs.requiredOnly)

			await installServer("@test/required-only-server", "test-client", {})

			// Should resolve user config
			expect(mockResolveUserConfig).toHaveBeenCalled()
		})
	})

	describe("User Declining Optional Config", () => {
		test("should not save empty config when user declines optional", async () => {
			mockResolveServer.mockResolvedValue({
				server: optionalOnlyServer,
				connection: optionalOnlyServer.connections[0],
			})
			mockGetConfig.mockResolvedValue(null)
			mockResolveUserConfig.mockResolvedValue(collectedConfigs.empty) // User said no

			await installServer("@test/optional-only-server", "test-client", {})

			// Should resolve user config (returns empty)
			expect(mockResolveUserConfig).toHaveBeenCalled()
			// Should NOT save empty config
			expect(mockSaveConfig).not.toHaveBeenCalled()
		})
	})
})
