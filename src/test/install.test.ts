/// <reference types="jest" />

import { installServer } from "../commands/install"
import { resolvePackage } from "../registry"
import { collectConfigValues } from "../utils/config"
import { readConfig, writeConfig } from "../client-config"
import type { ValidClient } from "../constants"
import chalk from "chalk"
import * as logger from "../logger"

jest.mock("../registry")
jest.mock("../utils/config", () => ({
	collectConfigValues: jest.fn(),
	chooseConnection: jest.fn(),
	normalizeServerId: jest.fn(id => id),
	denormalizeServerId: jest.fn(id => id),
	envVarsToArgs: jest.fn(),
	formatConfigValues: jest.fn(),
	chooseStdioConnection: jest.fn(),
}))
jest.mock("../utils/client", () => ({
	promptForRestart: jest.fn(),
}))
jest.mock("../client-config")
jest.mock("../logger")
jest.mock("ora", () => {
	const mockOra = () => ({
		start: () => ({
			succeed: jest.fn(),
			fail: jest.fn(),
		}),
	})
	return mockOra
})
jest.mock("../utils/analytics", () => ({
	checkAnalyticsConsent: jest.fn(),
}))
jest.mock("../utils/runtime", () => ({
	isUVRequired: jest.fn(),
	checkUVInstalled: jest.fn(),
	promptForUVInstall: jest.fn(),
	isBunRequired: jest.fn(),
	checkBunInstalled: jest.fn(),
	promptForBunInstall: jest.fn(),
	getRuntimePath: jest.fn(),
	getRuntimeEnvironment: jest.fn(),
}))

describe("installServer", () => {
	const testClient: ValidClient = "claude"
	const mockExit = jest.spyOn(process, "exit").mockImplementation((number) => {
		throw new Error(`process.exit: ${number}`)
	})

	beforeEach(() => {
		jest.clearAllMocks()
		// Mock the verbose function to prevent test output pollution
		jest.spyOn(logger, "verbose").mockImplementation(() => {})
	})

	test("installs stdio server successfully", async () => {
		// Setup mocks
		const mockServer = {
			qualifiedName: "test-server",
			displayName: "Test Server",
			connections: [
				{
					type: "stdio" as const,
					stdioFunction: "npx",
					configSchema: {},
				},
			],
		}
		;(resolvePackage as jest.Mock).mockResolvedValue(mockServer)
		;(collectConfigValues as jest.Mock).mockResolvedValue({ key: "value" })
		;(readConfig as jest.Mock).mockReturnValue({ mcpServers: {} })
		const consoleSpy = jest.spyOn(console, "log")

		// Execute
		await installServer("test-server", testClient)

		// Verify
		expect(resolvePackage).toHaveBeenCalledWith("test-server")
		expect(collectConfigValues).toHaveBeenCalled()
		expect(writeConfig).toHaveBeenCalledWith(
			{
				mcpServers: {
					"test-server": {
						command: "npx",
						args: [
							"-y",
							"@smithery/cli@latest",
							"run",
							"test-server",
							"--config",
							JSON.stringify(JSON.stringify({ key: "value" })),
						],
					},
				},
			},
			testClient,
		)
		expect(consoleSpy).toHaveBeenCalledWith(
			chalk.green("test-server successfully installed for claude"),
		)
	})

	test("installs websocket server successfully", async () => {
		// Setup mocks
		const mockServer = {
			qualifiedName: "test-ws-server",
			displayName: "Test WS Server",
			connections: [
				{
					type: "ws" as const,
					deploymentUrl: "ws://test.com",
					configSchema: {},
				},
			],
		}
		;(resolvePackage as jest.Mock).mockResolvedValue(mockServer)
		;(collectConfigValues as jest.Mock).mockResolvedValue({ key: "value" })
		;(readConfig as jest.Mock).mockReturnValue({ mcpServers: {} })

		// Execute
		await installServer("test-ws-server", testClient)

		// Verify
		expect(writeConfig).toHaveBeenCalledWith(
			{
				mcpServers: {
					"test-ws-server": {
						command: "npx",
						args: [
							"-y",
							"@smithery/cli@latest",
							"run",
							"test-ws-server",
							"--config",
							JSON.stringify(JSON.stringify({ key: "value" })),
						],
					},
				},
			},
			testClient,
		)
	})

	test("preserves existing servers in config", async () => {
		// Setup mocks
		const mockServer = {
			qualifiedName: "new-server",
			displayName: "New Server",
			connections: [
				{
					type: "stdio" as const,
					stdioFunction: "npx",
					configSchema: {},
				},
			],
		}

		const existingConfig = {
			mcpServers: {
				"existing-server": {
					command: "npx",
					args: ["existing", "args"],
				},
			},
		}
		;(resolvePackage as jest.Mock).mockResolvedValue(mockServer)
		;(collectConfigValues as jest.Mock).mockResolvedValue({ key: "value" })
		;(readConfig as jest.Mock).mockReturnValue(existingConfig)

		// Execute
		await installServer("new-server", testClient)

		// Verify
		expect(writeConfig).toHaveBeenCalledWith(
			{
				mcpServers: {
					"existing-server": {
						command: "npx",
						args: ["existing", "args"],
					},
					"new-server": {
						command: "npx",
						args: [
							"-y",
							"@smithery/cli@latest",
							"run",
							"new-server",
							"--config",
							JSON.stringify(JSON.stringify({ key: "value" })),
						],
					},
				},
			},
			testClient,
		)
	})

	test("should handle package not found error", async () => {
		const error = new Error("Package not found")
		;(resolvePackage as jest.Mock).mockRejectedValue(error)

		await expect(installServer("invalid-server", testClient)).rejects.toThrow()
		expect(mockExit).toHaveBeenCalledWith(1)
	})

	test("throws error when collectConfigValues fails", async () => {
		const mockServer = {
			qualifiedName: "test-server",
			connections: [
				{
					type: "stdio" as const,
					stdioFunction: "npx",
					configSchema: {},
				},
			],
		}
		;(resolvePackage as jest.Mock).mockResolvedValue(mockServer)
		;(collectConfigValues as jest.Mock).mockRejectedValue(
			new Error("Config collection failed"),
		)

		await expect(installServer("test-server", testClient)).rejects.toThrow()
		expect(mockExit).toHaveBeenCalledWith(1)
	})

	test("completes installation when analytics check fails", async () => {
		// Setup mocks
		const mockServer = {
			qualifiedName: "test-server",
			displayName: "Test Server",
			connections: [
				{
					type: "stdio" as const,
					stdioFunction: "npx",
					configSchema: {},
				},
			],
		}
		;(resolvePackage as jest.Mock).mockResolvedValue(mockServer)
		;(collectConfigValues as jest.Mock).mockResolvedValue({ key: "value" })
		;(readConfig as jest.Mock).mockReturnValue({ mcpServers: {} })

		// Mock analytics failure
		const mockCheckAnalytics = jest
			.spyOn(require("../utils/analytics"), "checkAnalyticsConsent")
			.mockRejectedValue(new Error("Analytics config failed"))
		const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()

		// Execute
		await installServer("test-server", testClient)

		// Verify
		expect(mockCheckAnalytics).toHaveBeenCalled()
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			expect.stringContaining("[Analytics] Failed to check consent:"),
			"Analytics config failed",
		)
		// Installation should still complete
		expect(writeConfig).toHaveBeenCalled()
		expect(mockExit).not.toHaveBeenCalled()
	})

	test("verbose logging is called with appropriate messages", async () => {
		// Setup mocks
		const mockServer = {
			qualifiedName: "test-server",
			displayName: "Test Server",
			connections: [
				{
					type: "stdio" as const,
					stdioFunction: "npx",
					configSchema: {},
				},
			],
		}
		;(resolvePackage as jest.Mock).mockResolvedValue(mockServer)
		;(collectConfigValues as jest.Mock).mockResolvedValue({ key: "value" })
		;(readConfig as jest.Mock).mockReturnValue({ mcpServers: {} })

		// Reset the mock to track calls
		jest.spyOn(logger, "verbose").mockClear()

		// Execute
		await installServer("test-server", testClient)

		// Verify verbose was called with expected messages
		expect(logger.verbose).toHaveBeenCalledWith(
			expect.stringContaining("Starting installation"),
		)
		expect(logger.verbose).toHaveBeenCalledWith(
			expect.stringContaining("Resolving package"),
		)
		expect(logger.verbose).toHaveBeenCalledWith(
			expect.stringContaining("Checking analytics consent"),
		)
		// We don't need to check every call, just ensure it's being used
	})

	test("continues installation with warning when UV is required but declined", async () => {
		const mockServer = {
			qualifiedName: "test-server",
			displayName: "Test Server",
			connections: [{
				type: "stdio" as const,
				stdioFunction: "uvx some-command",
				configSchema: {},
			}],
		}
		
		// Mock UV-related functions
		jest.spyOn(require("../utils/runtime"), "isUVRequired").mockReturnValue(true)
		jest.spyOn(require("../utils/runtime"), "checkUVInstalled").mockResolvedValue(false)
		jest.spyOn(require("../utils/runtime"), "promptForUVInstall").mockResolvedValue(false)
		
		;(resolvePackage as jest.Mock).mockResolvedValue(mockServer)
		;(collectConfigValues as jest.Mock).mockResolvedValue({ key: "value" })
		;(readConfig as jest.Mock).mockReturnValue({ mcpServers: {} })
		
		const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()

		await installServer("test-server", testClient)

		// Verify warning was shown but installation completed
		expect(consoleWarnSpy).toHaveBeenCalledWith(chalk.yellow("UV is not installed. The server might fail to launch."))
		expect(writeConfig).toHaveBeenCalled()
	})

	test("continues installation with warning when UV installation fails", async () => {
		const mockServer = {
			qualifiedName: "test-server",
			displayName: "Test Server",
			connections: [{
				type: "stdio" as const,
				stdioFunction: "uvx some-command",
				configSchema: {},
			}],
		}
		
		// Mock UV-related functions
		jest.spyOn(require("../utils/runtime"), "isUVRequired").mockReturnValue(true)
		jest.spyOn(require("../utils/runtime"), "checkUVInstalled").mockResolvedValue(false)
		jest.spyOn(require("../utils/runtime"), "promptForUVInstall").mockResolvedValue(false) // Installation failed
		
		;(resolvePackage as jest.Mock).mockResolvedValue(mockServer)
		;(collectConfigValues as jest.Mock).mockResolvedValue({ key: "value" })
		;(readConfig as jest.Mock).mockReturnValue({ mcpServers: {} })
		
		const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()

		await installServer("test-server", testClient)

		// Verify warning was shown but installation completed
		expect(consoleWarnSpy).toHaveBeenCalledWith(chalk.yellow("UV is not installed. The server might fail to launch."))
		expect(writeConfig).toHaveBeenCalled()
	})
})
