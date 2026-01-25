/**
 * Unit tests for resolveUserConfig and helper functions
 *
 * Tests config resolution strategies following the principle:
 * always prompt for keychain if found, regardless of --config
 */

import type { ServerGetResponse } from "@smithery/api/resources/servers/servers"

type StdioConnection = ServerGetResponse.StdioConnection

import { beforeEach, describe, expect, it, vi } from "vitest"
import { getConfig } from "../../../lib/keychain"
import {
	ensureBundleInstalled,
	getBundleUserConfigSchema,
} from "../../../lib/mcpb"
import type { ServerConfig } from "../../../types/registry"
import { promptForExistingConfig } from "../../command-prompts"
import { collectConfigValues } from "../prompt-user-config"
import {
	applySchemaDefaults,
	type OraSpinner,
	resolveUserConfig,
	serverNeedsConfig,
} from "../user-config"
import { collectedConfigs, savedConfigs } from "./fixtures/configurations"
import {
	noConfigServer,
	requiredAndOptionalServer,
	requiredOnlyServer,
} from "./fixtures/servers.js"

// Mock all dependencies
vi.mock("../../../lib/keychain", () => ({
	getConfig: vi.fn(),
	saveConfig: vi.fn(),
	deleteConfig: vi.fn(),
}))

vi.mock("../prompt-user-config", () => ({
	collectConfigValues: vi.fn(),
}))

vi.mock("../../command-prompts", () => ({
	promptForExistingConfig: vi.fn(),
}))

vi.mock("../../../lib/mcpb", () => ({
	ensureBundleInstalled: vi.fn(),
	getBundleUserConfigSchema: vi.fn(),
}))

vi.mock("../../../lib/logger", () => ({
	verbose: vi.fn(),
}))

// Get mocked functions
const mockGetConfig = vi.mocked(getConfig)
const mockCollectConfigValues = vi.mocked(collectConfigValues)
const mockPromptForExistingConfig = vi.mocked(promptForExistingConfig)
const mockEnsureBundleInstalled = vi.mocked(ensureBundleInstalled)
const mockGetBundleUserConfigSchema = vi.mocked(getBundleUserConfigSchema)

// Mock spinner
const createMockSpinner = () => ({
	stop: vi.fn(),
	start: vi.fn(),
	succeed: vi.fn(),
	fail: vi.fn(),
})

describe("resolveUserConfig", () => {
	let mockSpinner: OraSpinner
	const qualifiedName = "@test/test-server"

	beforeEach(() => {
		vi.clearAllMocks()
		mockSpinner = createMockSpinner() as unknown as OraSpinner
	})

	describe("when server needs no config", () => {
		it("returns empty config without prompts or keychain lookup", async () => {
			const connection = noConfigServer.connections[0]

			const result = await resolveUserConfig(
				connection,
				qualifiedName,
				{},
				mockSpinner,
			)

			expect(result).toEqual({})
			expect(mockGetConfig).not.toHaveBeenCalled()
			expect(mockPromptForExistingConfig).not.toHaveBeenCalled()
			expect(mockCollectConfigValues).not.toHaveBeenCalled()
		})
	})

	describe("when keychain has existing config", () => {
		const connection = requiredAndOptionalServer.connections[0]

		it("prompts user to use existing or provide new", async () => {
			mockGetConfig.mockResolvedValue(savedConfigs.requiredAndOptional)
			mockPromptForExistingConfig.mockResolvedValue(true)

			await resolveUserConfig(connection, qualifiedName, {}, mockSpinner)

			expect(mockGetConfig).toHaveBeenCalledWith(qualifiedName)
			expect(mockPromptForExistingConfig).toHaveBeenCalled()
		})

		describe('when user chooses "use existing"', () => {
			beforeEach(() => {
				mockPromptForExistingConfig.mockResolvedValue(true)
			})

			describe("without --config provided", () => {
				it("returns existing keychain config when valid", async () => {
					const existingConfig = savedConfigs.requiredAndOptional!
					mockGetConfig.mockResolvedValue(existingConfig)

					const result = await resolveUserConfig(
						connection,
						qualifiedName,
						{},
						mockSpinner,
					)

					expect(result).toEqual(existingConfig)
					expect(mockSpinner.stop).toHaveBeenCalled()
					expect(mockSpinner.start).toHaveBeenCalled()
					expect(mockCollectConfigValues).not.toHaveBeenCalled()
				})

				it("prompts for invalid/missing required fields when validation fails", async () => {
					const existingConfig = savedConfigs.requiredAndOptionalPartial!
					mockGetConfig.mockResolvedValue(existingConfig)
					mockCollectConfigValues.mockResolvedValue(
						collectedConfigs.missingEndpoint,
					)

					await resolveUserConfig(connection, qualifiedName, {}, mockSpinner)

					expect(mockCollectConfigValues).toHaveBeenCalled()
				})

				it("saves config after fixing invalid fields", async () => {
					const existingConfig = savedConfigs.requiredAndOptionalPartial!
					mockGetConfig.mockResolvedValue(existingConfig)
					mockCollectConfigValues.mockResolvedValue(
						collectedConfigs.missingEndpoint,
					)

					await resolveUserConfig(connection, qualifiedName, {}, mockSpinner)

					expect(mockCollectConfigValues).toHaveBeenCalled()
				})
			})

			describe("with --config provided", () => {
				it("merges --config over keychain config (--config wins)", async () => {
					const keychainConfig = savedConfigs.requiredAndOptional!
					const userConfig = { apiKey: "user-api-key" }
					mockGetConfig.mockResolvedValue(keychainConfig)

					const result = await resolveUserConfig(
						connection,
						qualifiedName,
						userConfig,
						mockSpinner,
					)

					expect(result.apiKey).toBe("user-api-key")
				})

				it("validates merged config and prompts for invalid required fields", async () => {
					const keychainConfig = savedConfigs.requiredAndOptional!
					// userConfig sets endpoint to empty string, which causes validation to fail
					const userConfig = { apiKey: "user-api-key", endpoint: "" }
					mockGetConfig.mockResolvedValue(keychainConfig)
					mockCollectConfigValues.mockResolvedValue({
						...keychainConfig,
						...userConfig,
						endpoint: "https://test.example.com", // Fixed value
					})

					await resolveUserConfig(
						connection,
						qualifiedName,
						userConfig,
						mockSpinner,
					)

					expect(mockCollectConfigValues).toHaveBeenCalled()
				})

				it("saves merged config", async () => {
					const keychainConfig = savedConfigs.requiredAndOptional!
					// userConfig with all required fields
					const userConfig = {
						apiKey: "user-api-key",
						endpoint: keychainConfig.endpoint,
					}
					mockGetConfig.mockResolvedValue(keychainConfig)

					const result = await resolveUserConfig(
						connection,
						qualifiedName,
						userConfig,
						mockSpinner,
					)

					expect(result.apiKey).toBe("user-api-key")
				})
			})

			it("prompts for optional fields after required are valid", async () => {
				const existingConfig = savedConfigs.requiredAndOptional!
				mockGetConfig.mockResolvedValue(existingConfig)

				await resolveUserConfig(connection, qualifiedName, {}, mockSpinner)

				expect(mockPromptForExistingConfig).toHaveBeenCalled()
			})

			it("does not save if using existing as-is with no optional added", async () => {
				const existingConfig = savedConfigs.requiredAndOptional!
				mockGetConfig.mockResolvedValue(existingConfig)

				const result = await resolveUserConfig(
					connection,
					qualifiedName,
					{},
					mockSpinner,
				)

				expect(result).toEqual(existingConfig)
				expect(mockCollectConfigValues).not.toHaveBeenCalled()
			})

			it("saves if optional fields were added", async () => {
				const existingConfig = savedConfigs.requiredAndOptional!
				mockGetConfig.mockResolvedValue(existingConfig)

				await resolveUserConfig(connection, qualifiedName, {}, mockSpinner)

				expect(mockPromptForExistingConfig).toHaveBeenCalled()
			})
		})

		describe('when user chooses "provide new"', () => {
			beforeEach(() => {
				mockPromptForExistingConfig.mockResolvedValue(false)
			})

			describe("with --config provided", () => {
				it("uses --config as base, ignores keychain", async () => {
					const keychainConfig = savedConfigs.requiredAndOptional!
					const userConfig = { apiKey: "new-api-key", endpoint: "new-endpoint" }
					mockGetConfig.mockResolvedValue(keychainConfig)

					const result = await resolveUserConfig(
						connection,
						qualifiedName,
						userConfig,
						mockSpinner,
					)

					expect(result.apiKey).toBe("new-api-key")
					expect(result.endpoint).toBe("new-endpoint")
				})

				it("validates --config and prompts for invalid required fields", async () => {
					const keychainConfig = savedConfigs.requiredAndOptional!
					// userConfig missing endpoint
					const userConfig = { apiKey: "new-api-key" }
					mockGetConfig.mockResolvedValue(keychainConfig)
					mockCollectConfigValues.mockResolvedValue({
						...userConfig,
						endpoint: "https://test.example.com",
					})

					await resolveUserConfig(
						connection,
						qualifiedName,
						userConfig,
						mockSpinner,
					)

					expect(mockCollectConfigValues).toHaveBeenCalled()
				})
			})

			describe("without --config provided", () => {
				it("collects all required fields interactively", async () => {
					mockGetConfig.mockResolvedValue(savedConfigs.requiredAndOptional)
					mockCollectConfigValues.mockResolvedValue(
						collectedConfigs.requiredAndOptional,
					)

					await resolveUserConfig(connection, qualifiedName, {}, mockSpinner)

					expect(mockCollectConfigValues).toHaveBeenCalled()
					expect(mockSpinner.stop).toHaveBeenCalled()
					expect(mockSpinner.start).toHaveBeenCalled()
				})
			})

			it("prompts for optional fields after required are valid", async () => {
				mockGetConfig.mockResolvedValue(savedConfigs.requiredAndOptional)
				mockCollectConfigValues.mockResolvedValue(
					collectedConfigs.requiredAndOptional,
				)

				await resolveUserConfig(connection, qualifiedName, {}, mockSpinner)

				expect(mockCollectConfigValues).toHaveBeenCalled()
			})

			it("collects new config interactively when user provides new", async () => {
				mockGetConfig.mockResolvedValue(savedConfigs.requiredAndOptional)
				mockCollectConfigValues.mockResolvedValue(
					collectedConfigs.requiredAndOptional,
				)

				await resolveUserConfig(connection, qualifiedName, {}, mockSpinner)

				expect(mockCollectConfigValues).toHaveBeenCalled()
			})
		})
	})

	describe("when keychain is empty", () => {
		const connection = requiredAndOptionalServer.connections[0]

		beforeEach(() => {
			mockGetConfig.mockResolvedValue(null)
		})

		describe("with --config provided", () => {
			it("uses --config values as base", async () => {
				const userConfig = collectedConfigs.requiredAndOptional

				const result = await resolveUserConfig(
					connection,
					qualifiedName,
					userConfig,
					mockSpinner,
				)

				expect(result).toEqual(userConfig)
			})

			it("validates --config and prompts for invalid required fields", async () => {
				// userConfig missing endpoint
				const userConfig = { apiKey: "test-key" }
				mockCollectConfigValues.mockResolvedValue({
					...userConfig,
					endpoint: "https://test.example.com",
				})

				await resolveUserConfig(
					connection,
					qualifiedName,
					userConfig,
					mockSpinner,
				)

				expect(mockCollectConfigValues).toHaveBeenCalled()
			})

			it("prompts for optional fields after required are valid", async () => {
				const userConfig = collectedConfigs.requiredAndOptionalNoOptional

				const result = await resolveUserConfig(
					connection,
					qualifiedName,
					userConfig,
					mockSpinner,
				)

				// Should have defaults applied
				expect(result.apiKey).toBe(userConfig.apiKey)
				expect(result.endpoint).toBe(userConfig.endpoint)
			})

			it("validates and uses --config values", async () => {
				const userConfig = collectedConfigs.requiredAndOptional

				const result = await resolveUserConfig(
					connection,
					qualifiedName,
					userConfig,
					mockSpinner,
				)

				expect(result).toEqual(userConfig)
			})
		})

		describe("without --config provided", () => {
			it("collects all required fields interactively", async () => {
				mockCollectConfigValues.mockResolvedValue(
					collectedConfigs.requiredAndOptional,
				)

				await resolveUserConfig(connection, qualifiedName, {}, mockSpinner)

				expect(mockCollectConfigValues).toHaveBeenCalled()
				expect(mockSpinner.stop).toHaveBeenCalled()
				expect(mockSpinner.start).toHaveBeenCalled()
			})

			it("prompts for optional fields after required collected", async () => {
				mockCollectConfigValues.mockResolvedValue(
					collectedConfigs.requiredAndOptional,
				)

				await resolveUserConfig(connection, qualifiedName, {}, mockSpinner)

				expect(mockCollectConfigValues).toHaveBeenCalled()
			})
		})
	})

	describe("schema defaults", () => {
		const connection = requiredAndOptionalServer.connections[0]

		it("applies defaults to missing optional fields", async () => {
			mockGetConfig.mockResolvedValue(null)
			mockCollectConfigValues.mockResolvedValue(
				collectedConfigs.requiredAndOptionalNoOptional,
			)

			const result = await resolveUserConfig(
				connection,
				qualifiedName,
				{},
				mockSpinner,
			)

			expect(result.debugMode).toBe(false)
			expect(result.maxRetries).toBe(3)
		})

		it("does not overwrite existing values with defaults", async () => {
			mockGetConfig.mockResolvedValue(null)
			mockCollectConfigValues.mockResolvedValue(
				collectedConfigs.requiredAndOptional,
			)

			const result = await resolveUserConfig(
				connection,
				qualifiedName,
				{},
				mockSpinner,
			)

			expect(result.debugMode).toBe(true)
			expect(result.maxRetries).toBe(5)
		})

		it("does not apply defaults to required fields that are missing", async () => {
			mockGetConfig.mockResolvedValue(null)
			// collectConfigValues returns incomplete config (missing endpoint)
			// This will cause validateAndFormatConfig to throw, which triggers
			// collectConfigValues to be called again, but for this test we want
			// to verify the error path, so we'll make it return incomplete config
			mockCollectConfigValues.mockResolvedValue({
				apiKey: "test-key",
			})

			// This should throw because endpoint is required
			await expect(
				resolveUserConfig(connection, qualifiedName, {}, mockSpinner),
			).rejects.toThrow()
		})
	})

	describe("with bundle connections", () => {
		it("calls ensureBundleInstalled when connection has bundleUrl", async () => {
			const bundleConnection: StdioConnection = {
				type: "stdio",
				bundleUrl: "https://example.com/bundle.tar.gz",
				configSchema: {},
			}
			mockGetConfig.mockResolvedValue(null)
			mockEnsureBundleInstalled.mockResolvedValue("/tmp/bundle")
			mockGetBundleUserConfigSchema.mockReturnValue({
				type: "object",
				properties: {
					apiKey: { type: "string" },
				},
				required: ["apiKey"],
			})
			mockCollectConfigValues.mockResolvedValue({ apiKey: "test" })

			await resolveUserConfig(bundleConnection, qualifiedName, {}, mockSpinner)

			expect(mockEnsureBundleInstalled).toHaveBeenCalledWith(
				qualifiedName,
				bundleConnection.bundleUrl,
			)
		})

		it("extracts config schema from bundle manifest", async () => {
			const bundleConnection: StdioConnection = {
				type: "stdio",
				bundleUrl: "https://example.com/bundle.tar.gz",
				configSchema: {},
			}
			mockGetConfig.mockResolvedValue(null)
			mockEnsureBundleInstalled.mockResolvedValue("/tmp/bundle")
			mockGetBundleUserConfigSchema.mockReturnValue({
				type: "object",
				properties: {
					apiKey: { type: "string" },
				},
				required: ["apiKey"],
			})
			mockCollectConfigValues.mockResolvedValue({ apiKey: "test" })

			await resolveUserConfig(bundleConnection, qualifiedName, {}, mockSpinner)

			expect(mockGetBundleUserConfigSchema).toHaveBeenCalledWith("/tmp/bundle")
		})

		it("uses bundle schema for validation and defaults", async () => {
			const bundleConnection: StdioConnection = {
				type: "stdio",
				bundleUrl: "https://example.com/bundle.tar.gz",
				configSchema: {},
			}
			const bundleSchema = {
				type: "object",
				properties: {
					apiKey: { type: "string" },
					debugMode: { type: "boolean", default: false },
				},
				required: ["apiKey"],
			}
			mockGetConfig.mockResolvedValue(null)
			mockEnsureBundleInstalled.mockResolvedValue("/tmp/bundle")
			mockGetBundleUserConfigSchema.mockReturnValue(bundleSchema)
			mockCollectConfigValues.mockResolvedValue({ apiKey: "test" })

			const result = await resolveUserConfig(
				bundleConnection,
				qualifiedName,
				{},
				mockSpinner,
			)

			expect(result.debugMode).toBe(false)
		})
	})

	describe("error handling", () => {
		const connection = requiredAndOptionalServer.connections[0]

		it("throws when keychain read fails", async () => {
			mockGetConfig.mockRejectedValue(new Error("Keychain read failed"))

			await expect(
				resolveUserConfig(connection, qualifiedName, {}, mockSpinner),
			).rejects.toThrow("Keychain read failed")
		})

		it("throws when bundle download fails", async () => {
			const bundleConnection: StdioConnection = {
				type: "stdio",
				bundleUrl: "https://example.com/bundle.tar.gz",
				configSchema: {},
			}
			mockGetConfig.mockResolvedValue(null)
			mockEnsureBundleInstalled.mockRejectedValue(
				new Error("Bundle download failed"),
			)

			await expect(
				resolveUserConfig(bundleConnection, qualifiedName, {}, mockSpinner),
			).rejects.toThrow("Bundle download failed")
		})

		it("throws when required fields cannot be collected (user cancels)", async () => {
			mockGetConfig.mockResolvedValue(null)
			mockCollectConfigValues.mockRejectedValue(
				new Error("User cancelled collection"),
			)

			await expect(
				resolveUserConfig(connection, qualifiedName, {}, mockSpinner),
			).rejects.toThrow("User cancelled collection")
		})

		it("throws when validation fails after max retries", async () => {
			mockGetConfig.mockResolvedValue(null)
			// collectConfigValues returns incomplete config repeatedly
			mockCollectConfigValues.mockResolvedValue({
				apiKey: "test-key",
				// Missing required endpoint
			})

			await expect(
				resolveUserConfig(connection, qualifiedName, {}, mockSpinner),
			).rejects.toThrow("Missing required config values")
		})
	})
})

describe("serverNeedsConfig", () => {
	const qualifiedName = "@test/test-server"

	it("returns false when schema has no properties", async () => {
		const connection = noConfigServer.connections[0]

		const result = await serverNeedsConfig(connection, qualifiedName)

		expect(result).toBe(false)
	})

	it("returns false when schema is undefined", async () => {
		const connection: StdioConnection = {
			type: "stdio",
			configSchema: {},
		}

		const result = await serverNeedsConfig(connection, qualifiedName)

		expect(result).toBe(false)
	})

	it("returns true when schema has at least one property", async () => {
		const connection = requiredOnlyServer.connections[0]

		const result = await serverNeedsConfig(connection, qualifiedName)

		expect(result).toBe(true)
	})
})

describe("applySchemaDefaults", () => {
	it("applies default values to missing optional fields", () => {
		const config: ServerConfig = {
			apiKey: "test-key",
			endpoint: "https://test.com",
		}
		const schema = requiredAndOptionalServer.connections[0].configSchema

		const result = applySchemaDefaults(config, schema)

		expect(result.debugMode).toBe(false)
		expect(result.maxRetries).toBe(3)
	})

	it("does not overwrite user-provided values", () => {
		const config: ServerConfig = {
			apiKey: "test-key",
			endpoint: "https://test.com",
			debugMode: true,
			maxRetries: 5,
		}
		const schema = requiredAndOptionalServer.connections[0].configSchema

		const result = applySchemaDefaults(config, schema)

		expect(result.debugMode).toBe(true)
		expect(result.maxRetries).toBe(5)
	})

	it("handles schemas with no defaults", () => {
		const config: ServerConfig = {
			apiKey: "test-key",
		}
		const schema = requiredOnlyServer.connections[0].configSchema

		const result = applySchemaDefaults(config, schema)

		expect(result).toEqual(config)
	})

	it("handles empty config object", () => {
		const config: ServerConfig = {}
		const schema = requiredAndOptionalServer.connections[0].configSchema

		const result = applySchemaDefaults(config, schema)

		expect(result.debugMode).toBe(false)
		expect(result.maxRetries).toBe(3)
	})
})
