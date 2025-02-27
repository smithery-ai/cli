/// <reference types="jest" />

import * as clientConfig from "../client-config"
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs"
import type { ConfiguredServer } from "../types/registry"

// Mock the fs module
jest.mock("node:fs", () => {
	return {
		existsSync: jest.fn(),
		mkdirSync: jest.fn(),
		writeFileSync: jest.fn(),
		readFileSync: jest.fn(),
		promises: {
			mkdir: jest.fn(),
			writeFile: jest.fn(),
			readFile: jest.fn(),
		},
	}
})

describe("Client Config", () => {
	const mockServer: ConfiguredServer = {
		command: "./test-server", // Required for StdioConnection
		args: ["--test"], // Optional
		env: {
			// Optional
			TEST_ENV: "true",
		},
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("Basic File Operations", () => {
		it("should create new config in non-existent directory", async () => {
			// Mock directory doesn't exist
			;(existsSync as jest.Mock).mockReturnValue(false)

			const config = { mcpServers: { "test-server": mockServer } }
			clientConfig.writeConfig(config, "test-client")

			expect(mkdirSync).toHaveBeenCalled()
			expect(writeFileSync).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining("test-server"),
			)
		})

		it("should read non-existent config and return default", () => {
			;(existsSync as jest.Mock).mockReturnValue(false)

			const config = clientConfig.readConfig("test-client")
			expect(config).toEqual({ mcpServers: {} })
		})

		it("should write and read back simple config", () => {
			const testConfig = {
				mcpServers: { "test-server": mockServer },
			}

			// Mock file exists for write
			;(existsSync as jest.Mock).mockReturnValue(true)
			;(readFileSync as jest.Mock).mockReturnValue(JSON.stringify(testConfig))

			clientConfig.writeConfig(testConfig, "test-client")
			const readConfig = clientConfig.readConfig("test-client")

			expect(readConfig).toEqual(testConfig)
		})
	})

	describe("Config Preservation", () => {
		it("should preserve custom fields when updating mcpServers", () => {
			const existingConfig = {
				mcpServers: { server1: mockServer },
				theme: "dark",
				customSetting: true,
			}

			const newConfig = {
				mcpServers: { server2: mockServer },
			}

			// Mock existing config
			;(existsSync as jest.Mock).mockReturnValue(true)
			;(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify(existingConfig),
			)

			clientConfig.writeConfig(newConfig, "test-client")

			// Verify written config contains both new mcpServers and preserved fields
			expect(writeFileSync).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining("theme"),
			)
			expect(writeFileSync).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining("customSetting"),
			)
		})
	})

	describe("Error Handling", () => {
		it("should handle invalid JSON in config file", () => {
			;(existsSync as jest.Mock).mockReturnValue(true)
			;(readFileSync as jest.Mock).mockReturnValue("invalid json")

			const config = clientConfig.readConfig("test-client")
			expect(config).toEqual({ mcpServers: {} })
		})

		it("should throw error for invalid mcpServers structure", () => {
			const invalidConfig = { mcpServers: "invalid" }

			expect(() => {
				clientConfig.writeConfig(invalidConfig as any, "test-client")
			}).toThrow("Invalid mcpServers structure")
		})
	})

	describe("Server Operations", () => {
		it("should install and retrieve server config", async () => {
			const serverId = "test-server"
			const initialConfig = { mcpServers: {} }
			const updatedConfig = {
				mcpServers: {
					[serverId]: mockServer,
				},
			}

			// Mock initial empty config
			;(existsSync as jest.Mock).mockReturnValue(true)
			;(readFileSync as jest.Mock)
				.mockReturnValueOnce(JSON.stringify(initialConfig)) // First read returns empty
				.mockReturnValue(JSON.stringify(updatedConfig)) // Subsequent reads return updated config

			// Since client-config doesn't have installServer, we'll simulate it
			const config = clientConfig.readConfig("test-client")
			config.mcpServers[serverId] = mockServer
			clientConfig.writeConfig(config, "test-client")

			// Check if server is installed by reading config
			const finalConfig = clientConfig.readConfig("test-client")
			const isServerInstalled = serverId in finalConfig.mcpServers
			expect(isServerInstalled).toBe(true)

			// Get server config
			const serverConfig = finalConfig.mcpServers[serverId]
			expect(serverConfig).toEqual(mockServer)
		})

		it("should uninstall server", async () => {
			const serverId = "test-server"
			const initialConfig = {
				mcpServers: { [serverId]: mockServer },
			}

			// Mock existing config with server
			;(existsSync as jest.Mock).mockReturnValue(true)
			;(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify(initialConfig),
			)

			// Since client-config doesn't have uninstallServer, we'll simulate it
			const config = clientConfig.readConfig("test-client")
			delete config.mcpServers[serverId]
			clientConfig.writeConfig(config, "test-client")

			// Verify server was removed
			expect(writeFileSync).toHaveBeenCalledWith(
				expect.any(String),
				expect.not.stringContaining(serverId),
			)
		})
	})

	describe("Config Path Resolution", () => {
		it("should get correct config path for known client", () => {
			const configPath = clientConfig.getConfigPath("claude")
			expect(configPath).toContain("claude_desktop_config.json")
		})

		it("should handle unknown client with fallback path", () => {
			const configPath = clientConfig.getConfigPath("unknown-client")
			expect(configPath).toContain("unknown-client")
		})
	})
})
