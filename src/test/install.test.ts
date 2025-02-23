/// <reference types="jest" />

import { installServer } from "../install"
import { resolvePackage } from "../registry"
import { collectConfigValues } from "../utils"
import { readConfig, writeConfig } from "../client-config"
import type { ValidClient } from "../constants"
import chalk from "chalk"

jest.mock("../registry")
jest.mock("../utils", () => ({
	...jest.requireActual("../utils"),
	collectConfigValues: jest.fn(),
	promptForRestart: jest.fn(),
}))
jest.mock("../config")

describe("installServer", () => {
	const testClient: ValidClient = "claude"

	beforeEach(() => {
		jest.clearAllMocks()
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

	test("throws error when resolvePackage fails", async () => {
		;(resolvePackage as jest.Mock).mockRejectedValue(
			new Error("Package not found"),
		)

		await expect(installServer("invalid-server", testClient)).rejects.toThrow(
			"Package not found",
		)
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

		await expect(installServer("test-server", testClient)).rejects.toThrow(
			"Config collection failed",
		)
	})
})
