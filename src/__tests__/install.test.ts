/**
 * Comprehensive Install Flow Tests
 * Matrix: Target Type × Transport
 *
 * Tests the complete installation flow including:
 * - Config formatting (formatServerConfig)
 * - Target writing (writeConfig for files, runConfigCommand for commands)
 * - Client-specific handling
 */

import { describe, test, expect, vi, beforeEach } from "vitest"
import { Transport, type ClientConfiguration } from "../config/clients"
import type { ServerDetailResponse } from "@smithery/registry/models/components"
import type {
	StdioConnection,
	StreamableHTTPConnection,
} from "../types/registry"

// Mock all the dependencies using factory functions
vi.mock("../utils/mcp-config", () => ({
	writeConfig: vi.fn(),
	runConfigCommand: vi.fn(),
	readConfig: vi.fn(),
}))

vi.mock("../lib/registry", () => ({
	resolveServer: vi.fn(),
	ResolveServerSource: { Install: "install" },
	saveUserConfig: vi.fn(),
	validateUserConfig: vi.fn(),
}))

vi.mock("../utils/session-config", () => ({
	chooseConnection: vi.fn(),
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
import { writeConfig, runConfigCommand, readConfig } from "../utils/mcp-config"
import { resolveServer } from "../lib/registry"
import {
	chooseConnection,
	collectConfigValues,
	formatServerConfig,
	getServerName,
} from "../utils/session-config"
import { getClientConfiguration } from "../config/clients"

// Get mocked functions
const mockWriteConfig = vi.mocked(writeConfig)
const mockRunConfigCommand = vi.mocked(runConfigCommand)
const mockReadConfig = vi.mocked(readConfig)
const mockResolveServer = vi.mocked(resolveServer)
const mockChooseConnection = vi.mocked(chooseConnection)
const mockCollectConfigValues = vi.mocked(collectConfigValues)
const mockFormatServerConfig = vi.mocked(formatServerConfig)
const mockGetServerName = vi.mocked(getServerName)
const mockGetClientConfiguration = vi.mocked(getClientConfiguration)

// Test server configurations
const mockStdioServer: ServerDetailResponse = {
	qualifiedName: "test-server",
	remote: false,
	connections: [{ type: "stdio", command: "npx", args: ["test-server"] }],
} as unknown as ServerDetailResponse

const mockHttpServer: ServerDetailResponse = {
	qualifiedName: "test-server",
	remote: true,
	connections: [
		{
			type: "http",
			deploymentUrl: "https://server.smithery.ai/test-server/mcp",
		},
	],
} as unknown as ServerDetailResponse

// Test client configurations for the matrix
const TEST_CLIENT_CONFIGS: Record<string, ClientConfiguration> = {
	// File-based clients
	"json-stdio": {
		label: "JSON STDIO Client",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: "/tmp/test-client.json",
	},
	"json-http": {
		label: "JSON HTTP Client",
		supportedTransports: [Transport.HTTP],
		installType: "json",
		path: "/tmp/test-client.json",
		supportsOAuth: true,
	},
	"yaml-stdio": {
		label: "YAML STDIO Client",
		supportedTransports: [Transport.STDIO],
		installType: "yaml",
		path: "/tmp/test-client.yaml",
	},
	"toml-stdio": {
		label: "TOML STDIO Client",
		supportedTransports: [Transport.STDIO],
		installType: "toml",
		path: "/tmp/test-client.toml",
	},

	// Command-based clients
	"command-stdio": {
		label: "Command STDIO Client",
		supportedTransports: [Transport.STDIO],
		installType: "command",
		command: "test-cli",
		commandConfig: {
			stdio: (name: string, command: string, args: string[]) => [
				"--add-server",
				name,
				command,
				...args,
			],
		},
	},
	"command-http": {
		label: "Command HTTP Client",
		supportedTransports: [Transport.HTTP],
		installType: "command",
		command: "test-cli",
		supportsOAuth: true,
		commandConfig: {
			http: (name: string, url: string) => [
				"mcp",
				"add",
				"--transport",
				"http",
				name,
				url,
			],
		},
	},
}

describe("Installation Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()

		// Default mock setup
		mockResolveServer.mockResolvedValue(mockStdioServer)
		mockChooseConnection.mockReturnValue({ type: "stdio", configSchema: {} })
		mockCollectConfigValues.mockResolvedValue({})
		mockGetServerName.mockReturnValue("test-server")
		mockReadConfig.mockReturnValue({ mcpServers: {} })
	})

	describe("target: json", () => {
		describe("transport: stdio", () => {
			test("should format config and write to JSON file", async () => {
				const clientConfig = TEST_CLIENT_CONFIGS["json-stdio"]
				const expectedConfig = {
					command: "npx",
					args: [
						"-y",
						"@smithery/cli@latest",
						"run",
						"test-server",
						"--key",
						"test-api-key",
					],
				} as StdioConnection

				mockGetClientConfiguration.mockReturnValue(clientConfig)
				mockFormatServerConfig.mockReturnValue(expectedConfig)
				mockResolveServer.mockResolvedValue(mockStdioServer)

				await installServer(
					"test-server",
					"json-stdio",
					{},
					"test-api-key",
					undefined,
				)

				// Verify the complete flow
				expect(mockFormatServerConfig).toHaveBeenCalledWith(
					"test-server",
					{}, // config
					"test-api-key",
					undefined, // profile
					"json-stdio",
					mockStdioServer,
				)

				// Verify config was written to file (not command executed)
				expect(mockWriteConfig).toHaveBeenCalledWith(
					{ mcpServers: { "test-server": expectedConfig } },
					"json-stdio",
				)
				expect(mockRunConfigCommand).not.toHaveBeenCalled()
			})
		})

		describe("transport: http", () => {
			test("should format HTTP config and write to JSON file", async () => {
				const clientConfig = TEST_CLIENT_CONFIGS["json-http"]
				const expectedConfig = {
					type: "http",
					url: "https://server.smithery.ai/test-server/mcp",
					headers: {},
				} as StreamableHTTPConnection

				mockGetClientConfiguration.mockReturnValue(clientConfig)
				mockFormatServerConfig.mockReturnValue(expectedConfig)
				mockResolveServer.mockResolvedValue(mockHttpServer)

				await installServer(
					"test-server",
					"json-http",
					{},
					"test-api-key",
					undefined,
				)

				expect(mockFormatServerConfig).toHaveBeenCalledWith(
					"test-server",
					{},
					"test-api-key",
					undefined,
					"json-http",
					mockHttpServer,
				)

				expect(mockWriteConfig).toHaveBeenCalledWith(
					{ mcpServers: { "test-server": expectedConfig } },
					"json-http",
				)
			})
		})
	})

	describe("target: yaml", () => {
		describe("transport: stdio", () => {
			test("should format config and write to YAML file", async () => {
				const clientConfig = TEST_CLIENT_CONFIGS["yaml-stdio"]
				const expectedConfig = {
					command: "npx",
					args: [
						"-y",
						"@smithery/cli@latest",
						"run",
						"test-server",
						"--key",
						"test-api-key",
					],
				} as StdioConnection

				mockGetClientConfiguration.mockReturnValue(clientConfig)
				mockFormatServerConfig.mockReturnValue(expectedConfig)

				await installServer(
					"test-server",
					"yaml-stdio",
					{},
					"test-api-key",
					undefined,
				)

				expect(mockWriteConfig).toHaveBeenCalledWith(
					{ mcpServers: { "test-server": expectedConfig } },
					"yaml-stdio",
				)
			})
		})
	})

	describe("target: toml", () => {
		describe("transport: stdio", () => {
			test("should format config and write to TOML file", async () => {
				const clientConfig = TEST_CLIENT_CONFIGS["toml-stdio"]
				const expectedConfig = {
					command: "npx",
					args: [
						"-y",
						"@smithery/cli@latest",
						"run",
						"test-server",
						"--key",
						"test-api-key",
					],
				} as StdioConnection

				mockGetClientConfiguration.mockReturnValue(clientConfig)
				mockFormatServerConfig.mockReturnValue(expectedConfig)

				await installServer(
					"test-server",
					"toml-stdio",
					{},
					"test-api-key",
					undefined,
				)

				expect(mockWriteConfig).toHaveBeenCalledWith(
					{ mcpServers: { "test-server": expectedConfig } },
					"toml-stdio",
				)
			})
		})
	})

	describe("target: command", () => {
		describe("transport: stdio", () => {
			test("should format config and execute command", async () => {
				const clientConfig = TEST_CLIENT_CONFIGS["command-stdio"]
				const expectedConfig = {
					command: "npx",
					args: [
						"-y",
						"@smithery/cli@latest",
						"run",
						"test-server",
						"--key",
						"test-api-key",
					],
				} as StdioConnection

				mockGetClientConfiguration.mockReturnValue(clientConfig)
				mockFormatServerConfig.mockReturnValue(expectedConfig)

				await installServer(
					"test-server",
					"command-stdio",
					{},
					"test-api-key",
					undefined,
				)

				// Verify command was executed (not file written)
				expect(mockRunConfigCommand).toHaveBeenCalledWith(
					{ mcpServers: { "test-server": expectedConfig } },
					clientConfig,
				)
				expect(mockWriteConfig).not.toHaveBeenCalled()
			})
		})

		describe("transport: http", () => {
			test("should format HTTP config and execute command", async () => {
				const clientConfig = TEST_CLIENT_CONFIGS["command-http"]
				const expectedConfig = {
					type: "http",
					url: "https://server.smithery.ai/test-server/mcp",
					headers: {},
				} as StreamableHTTPConnection

				mockGetClientConfiguration.mockReturnValue(clientConfig)
				mockFormatServerConfig.mockReturnValue(expectedConfig)
				mockResolveServer.mockResolvedValue(mockHttpServer)

				await installServer(
					"test-server",
					"command-http",
					{},
					"test-api-key",
					undefined,
				)

				expect(mockRunConfigCommand).toHaveBeenCalledWith(
					{ mcpServers: { "test-server": expectedConfig } },
					clientConfig,
				)
				expect(mockWriteConfig).not.toHaveBeenCalled()
			})
		})
	})

	describe("matrix validation", () => {
		test("should cover all target types", () => {
			const targetTypes = ["json", "command", "yaml", "toml"]
			const configuredTargets = Object.values(TEST_CLIENT_CONFIGS).map(
				(c) => c.installType,
			)

			for (const targetType of targetTypes) {
				expect(configuredTargets).toContain(targetType)
			}
		})

		test("should cover all transport types", () => {
			const transports = [Transport.STDIO, Transport.HTTP]
			const configuredTransports = Object.values(TEST_CLIENT_CONFIGS).flatMap(
				(c) => c.supportedTransports,
			)

			for (const transport of transports) {
				expect(configuredTransports).toContain(transport)
			}
		})
	})
})
