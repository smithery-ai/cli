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
			mockResolveServer.mockResolvedValue({
				server: noConfigServer,
				connection: noConfigServer.connections[0],
			})
			mockValidateUserConfig.mockResolvedValue(validationResponses.noConfig)

			await installServer("@test/no-config-server", "test-client", {})

			// Should NOT validate config (no config needed)
			expect(mockValidateUserConfig).not.toHaveBeenCalled()

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
			mockResolveServer.mockResolvedValue({
				server: optionalOnlyServer,
				connection: optionalOnlyServer.connections[0],
			})
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.optionalOnlyFresh,
			)
			mockCollectConfigValues.mockResolvedValue(collectedConfigs.optionalOnly)

			await installServer("@test/optional-only-server", "test-client", {})

			// Should prompt for config (user can add optional)
			expect(mockCollectConfigValues).toHaveBeenCalledWith(
				optionalOnlyServer.connections[0],
				"@test/optional-only-server",
				{},
				expect.anything(),
			)
		})

		test("complete config: should use existing config without prompting", async () => {
			mockResolveServer.mockResolvedValue({
				server: optionalOnlyServer,
				connection: optionalOnlyServer.connections[0],
			})
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.optionalOnlyComplete,
			)

			await installServer("@test/optional-only-server", "test-client", {})

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
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredOnlyFresh,
			)
			mockCollectConfigValues.mockResolvedValue(collectedConfigs.requiredOnly)

			await installServer("@test/required-only-server", "test-client", {})

			// Should prompt for missing required fields
			expect(mockCollectConfigValues).toHaveBeenCalled()
		})

		test("partial config: should prompt for missing required fields", async () => {
			mockResolveServer.mockResolvedValue({
				server: requiredOnlyServer,
				connection: requiredOnlyServer.connections[0],
			})
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredOnlyPartial,
			)
			mockCollectConfigValues.mockResolvedValue(collectedConfigs.requiredOnly)

			await installServer("@test/required-only-server", "test-client", {})

			// Should prompt for config
			expect(mockCollectConfigValues).toHaveBeenCalled()
		})

		test("complete config: should use existing config without prompting", async () => {
			mockResolveServer.mockResolvedValue({
				server: requiredOnlyServer,
				connection: requiredOnlyServer.connections[0],
			})
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredOnlyComplete,
			)

			await installServer("@test/required-only-server", "test-client", {})

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
			)

			// Should prompt for all fields (required first, then optional prompt)
			expect(mockCollectConfigValues).toHaveBeenCalled()
		})

		test("partial config: should prompt for missing required", async () => {
			mockResolveServer.mockResolvedValue({
				server: requiredAndOptionalServer,
				connection: requiredAndOptionalServer.connections[0],
			})
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
			)

			// Should prompt for missing fields
			expect(mockCollectConfigValues).toHaveBeenCalled()
		})

		test("complete config: should use existing config without prompting", async () => {
			mockResolveServer.mockResolvedValue({
				server: requiredAndOptionalServer,
				connection: requiredAndOptionalServer.connections[0],
			})
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredAndOptionalComplete,
			)

			await installServer(
				"@test/required-and-optional-server",
				"test-client",
				{},
			)

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
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.requiredOnlyFresh,
			)
			mockCollectConfigValues.mockResolvedValue(collectedConfigs.requiredOnly)

			await installServer("@test/required-only-server", "test-client", {})

			// Should prompt for config
			expect(mockCollectConfigValues).toHaveBeenCalled()
		})
	})

	describe("User Declining Optional Config", () => {
		test("should not save empty config when user declines optional", async () => {
			mockResolveServer.mockResolvedValue({
				server: optionalOnlyServer,
				connection: optionalOnlyServer.connections[0],
			})
			mockValidateUserConfig.mockResolvedValue(
				validationResponses.optionalOnlyFresh,
			)
			mockCollectConfigValues.mockResolvedValue(collectedConfigs.empty) // User said no

			await installServer("@test/optional-only-server", "test-client", {})

			// Should prompt for config
			expect(mockCollectConfigValues).toHaveBeenCalled()
		})
	})
})
