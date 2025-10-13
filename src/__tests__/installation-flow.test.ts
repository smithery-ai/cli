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
import {
	resolveServer,
	saveUserConfig,
	validateUserConfig,
} from "../lib/registry"
import { readConfig, writeConfig } from "../utils/mcp-config"
import {
	collectConfigValues,
	formatServerConfig,
	getServerName,
} from "../utils/session-config"
import {
	collectedConfigs,
	validationResponses,
} from "./fixtures/configurations"
import {
	noConfigServer,
	optionalOnlyServer,
	requiredAndOptionalServer,
	requiredOnlyServer,
} from "./fixtures/servers"

// Mock all dependencies
vi.mock("../utils/mcp-config")
vi.mock("../lib/registry")
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
vi.mock("inquirer", () => ({
	default: {
		prompt: vi.fn().mockResolvedValue({ updateConfig: false }),
	},
}))

// Mock process.exit
vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

// Get mocked functions
const mockValidateUserConfig = vi.mocked(validateUserConfig)
const mockCollectConfigValues = vi.mocked(collectConfigValues)
const mockSaveUserConfig = vi.mocked(saveUserConfig)
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
			mockResolveServer.mockResolvedValue(noConfigServer)
			mockValidateUserConfig.mockResolvedValue(validationResponses.noConfig)

			await installServer(
				"@test/no-config-server",
				"test-client",
				{},
				"test-api-key",
				undefined,
			)

			// Should validate config
			expect(mockValidateUserConfig).toHaveBeenCalledWith(
				"@test/no-config-server",
				"test-api-key",
				undefined,
			)

			// Should NOT prompt for config
			expect(mockCollectConfigValues).not.toHaveBeenCalled()

			// Should NOT save config
			expect(mockSaveUserConfig).not.toHaveBeenCalled()

			// Should write to client config
			expect(mockWriteConfig).toHaveBeenCalled()
		})
	})

	describe("2. Optional Only Server", () => {
		test("fresh install: should ask about optional config", async () => {
			mockResolveServer.mockResolvedValue(optionalOnlyServer)
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.optionalOnlyFresh,
			)
			mockCollectConfigValues.mockResolvedValue(collectedConfigs.optionalOnly)

			await installServer(
				"@test/optional-only-server",
				"test-client",
				{},
				"test-api-key",
				undefined,
			)

			// Should validate config
			expect(mockValidateUserConfig).toHaveBeenCalled()

			// Should prompt for config (user can add optional)
			expect(mockCollectConfigValues).toHaveBeenCalledWith(
				optionalOnlyServer.connections[0],
				{},
			)

			// Should save config if user added some
			expect(mockSaveUserConfig).toHaveBeenCalledWith(
				"@test/optional-only-server",
				collectedConfigs.optionalOnly,
				"test-api-key",
				undefined,
			)
		})

		test("complete config: should use existing config without prompting", async () => {
			mockResolveServer.mockResolvedValue(optionalOnlyServer)
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.optionalOnlyComplete,
			)

			await installServer(
				"@test/optional-only-server",
				"test-client",
				{},
				"test-api-key",
				undefined,
			)

			// Should validate config
			expect(mockValidateUserConfig).toHaveBeenCalled()

			// Should NOT prompt for config (use existing)
			expect(mockCollectConfigValues).not.toHaveBeenCalled()

			// Should NOT save config (using existing)
			expect(mockSaveUserConfig).not.toHaveBeenCalled()
		})
	})

	describe("3. Required Only Server", () => {
		test("fresh install: should prompt for required config", async () => {
			mockResolveServer.mockResolvedValue(requiredOnlyServer)
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredOnlyFresh,
			)
			mockCollectConfigValues.mockResolvedValue(collectedConfigs.requiredOnly)

			await installServer(
				"@test/required-only-server",
				"test-client",
				{},
				"test-api-key",
				undefined,
			)

			// Should validate config
			expect(mockValidateUserConfig).toHaveBeenCalled()

			// Should prompt for missing required fields
			expect(mockCollectConfigValues).toHaveBeenCalled()

			// Should save the collected config
			expect(mockSaveUserConfig).toHaveBeenCalledWith(
				"@test/required-only-server",
				collectedConfigs.requiredOnly,
				"test-api-key",
				undefined,
			)
		})

		test("partial config: should prompt for missing required fields", async () => {
			mockResolveServer.mockResolvedValue(requiredOnlyServer)
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredOnlyPartial,
			)
			mockCollectConfigValues.mockResolvedValue(collectedConfigs.requiredOnly)

			await installServer(
				"@test/required-only-server",
				"test-client",
				{},
				"test-api-key",
				undefined,
			)

			// Should validate and find missing fields
			expect(mockValidateUserConfig).toHaveBeenCalled()

			// Should prompt for config
			expect(mockCollectConfigValues).toHaveBeenCalled()

			// Should save the updated config
			expect(mockSaveUserConfig).toHaveBeenCalled()
		})

		test("complete config: should use existing config without prompting", async () => {
			mockResolveServer.mockResolvedValue(requiredOnlyServer)
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredOnlyComplete,
			)

			await installServer(
				"@test/required-only-server",
				"test-client",
				{},
				"test-api-key",
				undefined,
			)

			// Should validate config
			expect(mockValidateUserConfig).toHaveBeenCalled()

			// Should NOT prompt for config (use existing)
			expect(mockCollectConfigValues).not.toHaveBeenCalled()

			// Should NOT save (using existing)
			expect(mockSaveUserConfig).not.toHaveBeenCalled()
		})
	})

	describe("4. Required + Optional Server", () => {
		test("fresh install: should prompt for required, then ask about optional", async () => {
			mockResolveServer.mockResolvedValue(requiredAndOptionalServer)
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredAndOptionalFresh,
			)
			mockCollectConfigValues.mockResolvedValue(
				collectedConfigs.requiredAndOptional,
			)

			await installServer(
				"@test/required-and-optional-server",
				"test-client",
				{},
				"test-api-key",
				undefined,
			)

			// Should validate config
			expect(mockValidateUserConfig).toHaveBeenCalled()

			// Should prompt for all fields (required first, then optional prompt)
			expect(mockCollectConfigValues).toHaveBeenCalled()

			// Should save the collected config
			expect(mockSaveUserConfig).toHaveBeenCalledWith(
				"@test/required-and-optional-server",
				collectedConfigs.requiredAndOptional,
				"test-api-key",
				undefined,
			)
		})

		test("partial config: should prompt for missing required", async () => {
			mockResolveServer.mockResolvedValue(requiredAndOptionalServer)
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredAndOptionalPartial,
			)
			mockCollectConfigValues.mockResolvedValue(
				collectedConfigs.missingEndpoint,
			)

			await installServer(
				"@test/required-and-optional-server",
				"test-client",
				{},
				"test-api-key",
				undefined,
			)

			// Should validate and find missing endpoint
			expect(mockValidateUserConfig).toHaveBeenCalled()

			// Should prompt for missing fields
			expect(mockCollectConfigValues).toHaveBeenCalled()

			// Should save the collected config
			expect(mockSaveUserConfig).toHaveBeenCalled()
		})

		test("complete config: should use existing config without prompting", async () => {
			mockResolveServer.mockResolvedValue(requiredAndOptionalServer)
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredAndOptionalComplete,
			)

			await installServer(
				"@test/required-and-optional-server",
				"test-client",
				{},
				"test-api-key",
				undefined,
			)

			// Should validate config
			expect(mockValidateUserConfig).toHaveBeenCalled()

			// Should NOT prompt for config (use existing)
			expect(mockCollectConfigValues).not.toHaveBeenCalled()

			// Should NOT save (using existing)
			expect(mockSaveUserConfig).not.toHaveBeenCalled()
		})
	})

	describe("Profile Support", () => {
		test("should pass profile to validation and save", async () => {
			mockResolveServer.mockResolvedValue(requiredOnlyServer)
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredOnlyFresh,
			)
			mockCollectConfigValues.mockResolvedValue(collectedConfigs.requiredOnly)

			await installServer(
				"@test/required-only-server",
				"test-client",
				{},
				"test-api-key",
				"test-profile-123",
			)

			// Should pass profile to validation
			expect(mockValidateUserConfig).toHaveBeenCalledWith(
				"@test/required-only-server",
				"test-api-key",
				"test-profile-123",
			)

			// Should pass profile to save
			expect(mockSaveUserConfig).toHaveBeenCalledWith(
				"@test/required-only-server",
				collectedConfigs.requiredOnly,
				"test-api-key",
				"test-profile-123",
			)
		})
	})

	describe("User Declining Optional Config", () => {
		test("should not save empty config when user declines optional", async () => {
			mockResolveServer.mockResolvedValue(optionalOnlyServer)
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.optionalOnlyFresh,
			)
			mockCollectConfigValues.mockResolvedValue(collectedConfigs.empty) // User said no

			await installServer(
				"@test/optional-only-server",
				"test-client",
				{},
				"test-api-key",
				undefined,
			)

			// Should prompt for config
			expect(mockCollectConfigValues).toHaveBeenCalled()

			// Should NOT save empty config
			expect(mockSaveUserConfig).not.toHaveBeenCalled()
		})
	})
})
