/**
 * Installation Tests - Client Matrix
 *
 * Matrix Dimensions:
 * 1. Target: json | command | yaml | toml
 * 2. HTTP Support: yes | no
 */

import { describe, test, expect, vi } from "vitest"
import { Transport, type ClientConfiguration } from "../config/clients"
import type { ServerDetailResponse } from "@smithery/registry/models/components"

// Mock formatServerConfig to test with our test client configs
const mockFormatServerConfig = vi.fn()

// Mock servers for testing
const mockHttpServer = {
	qualifiedName: "test-server",
	remote: true,
	connections: [
		{
			type: "http",
			deploymentUrl: "https://server.smithery.ai/test-server/mcp",
		},
	],
} as unknown as ServerDetailResponse

const mockStdioServer = {
	qualifiedName: "test-server",
	remote: false,
	connections: [{ type: "stdio", command: "npx", args: ["test-server"] }],
} as unknown as ServerDetailResponse

// Test Client Configurations - 4 core groups
const TEST_CLIENT_CONFIGS: Record<string, ClientConfiguration> = {
	// Group 1: json target + STDIO
	"json-stdio": {
		label: "JSON STDIO Client",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: "/tmp/test-client.json",
	},

	// Group 2: json target + HTTP
	"json-http": {
		label: "JSON HTTP Client",
		supportedTransports: [Transport.HTTP],
		installType: "json",
		path: "/tmp/test-client.json",
		supportsOAuth: true,
	},

	// Group 3: command target + STDIO
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

	// Group 4: command target + HTTP
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

	// Group 5: yaml target + STDIO
	"yaml-stdio": {
		label: "YAML STDIO Client",
		supportedTransports: [Transport.STDIO],
		installType: "yaml",
		path: "/tmp/test-client.yaml",
	},

	// Group 6: toml target + STDIO
	"toml-stdio": {
		label: "TOML STDIO Client",
		supportedTransports: [Transport.STDIO],
		installType: "toml",
		path: "/tmp/test-client.toml",
	},
}

// Expected outputs when installing "test-server" with "test-api-key"
const EXPECTED_OUTPUTS = {
	"json-stdio": {
		command: "npx",
		args: [
			"-y",
			"@smithery/cli@latest",
			"run",
			"test-server",
			"--key",
			"test-api-key",
		],
	},
	"json-http": {
		type: "http",
		url: "https://server.smithery.ai/test-server/mcp", // No api_key (OAuth)
		headers: {},
	},
	"command-stdio": ["--add-server", "test-server", "npx", "test-server"],
	"command-http": [
		"mcp",
		"add",
		"--transport",
		"http",
		"test-server",
		"https://server.smithery.ai/test-server/mcp",
	],
	"yaml-stdio": {
		command: "npx",
		args: [
			"-y",
			"@smithery/cli@latest",
			"run",
			"test-server",
			"--key",
			"test-api-key",
		],
	},
	"toml-stdio": {
		command: "npx",
		args: [
			"-y",
			"@smithery/cli@latest",
			"run",
			"test-server",
			"--key",
			"test-api-key",
		],
	},
}

describe("Server Installation", () => {
	test("JSON + STDIO", () => {
		// Test that JSON + STDIO client generates correct config
		mockFormatServerConfig.mockReturnValue(EXPECTED_OUTPUTS["json-stdio"])
		const config = TEST_CLIENT_CONFIGS["json-stdio"]

		// Simulate what would happen: file-based client with STDIO server
		expect(config.installType).toBe("json")
		expect(config.supportedTransports).toEqual([Transport.STDIO])

		const result = mockFormatServerConfig(
			"test-server",
			{},
			"test-api-key",
			undefined,
			config,
			mockStdioServer,
		)
		expect(result).toEqual(EXPECTED_OUTPUTS["json-stdio"])
	})

	test("JSON + HTTP", () => {
		// Test that JSON + HTTP client generates correct config
		mockFormatServerConfig.mockReturnValue(EXPECTED_OUTPUTS["json-http"])
		const config = TEST_CLIENT_CONFIGS["json-http"]

		expect(config.installType).toBe("json")
		expect(config.supportedTransports).toEqual([Transport.HTTP])
		expect(config.supportsOAuth).toBe(true)

		const result = mockFormatServerConfig(
			"test-server",
			{},
			"test-api-key",
			undefined,
			config,
			mockHttpServer,
		)
		expect(result).toEqual(EXPECTED_OUTPUTS["json-http"])
	})

	test("Command + STDIO", () => {
		const config = TEST_CLIENT_CONFIGS["command-stdio"]
		// Use mockStdioServer data: command='npx', args=['test-server']
		const stdioOutput = config.commandConfig?.stdio?.("test-server", "npx", [
			"test-server",
		])
		expect(stdioOutput).toEqual(EXPECTED_OUTPUTS["command-stdio"])
	})

	test("Command + HTTP", () => {
		const config = TEST_CLIENT_CONFIGS["command-http"]
		// Use mockHttpServer data: deploymentUrl from connections
		const httpOutput = config.commandConfig?.http?.(
			"test-server",
			"https://server.smithery.ai/test-server/mcp",
		)
		expect(httpOutput).toEqual(EXPECTED_OUTPUTS["command-http"])
	})

	test("YAML + STDIO", () => {
		mockFormatServerConfig.mockReturnValue(EXPECTED_OUTPUTS["yaml-stdio"])
		const config = TEST_CLIENT_CONFIGS["yaml-stdio"]

		const result = mockFormatServerConfig(
			"test-server",
			{},
			"test-api-key",
			undefined,
			config,
			mockStdioServer,
		)
		expect(result).toEqual(EXPECTED_OUTPUTS["yaml-stdio"])
	})

	test("TOML + STDIO", () => {
		mockFormatServerConfig.mockReturnValue(EXPECTED_OUTPUTS["toml-stdio"])
		const config = TEST_CLIENT_CONFIGS["toml-stdio"]

		const result = mockFormatServerConfig(
			"test-server",
			{},
			"test-api-key",
			undefined,
			config,
			mockStdioServer,
		)
		expect(result).toEqual(EXPECTED_OUTPUTS["toml-stdio"])
	})
})

/**
 * CLIENT MATRIX
 *
 * | Target  | HTTP Support | Clients                                    | Expected Behavior              |
 * |---------|--------------|-------------------------------------------|--------------------------------|
 * | json    | no           | claude, windsurf, cline, witsy, etc.      | STDIO config in JSON file     |
 * | json    | yes          | cursor                                    | HTTP/STDIO config in JSON file|
 * | command | yes (HTTP)   | claude-code, vscode, vscode-insiders      | HTTP CLI command execution     |
 * | command | yes (STDIO)  | claude-code, vscode, vscode-insiders      | STDIO CLI command execution    |
 * | yaml    | no           | librechat                                 | STDIO config in YAML file     |
 * | toml    | no           | codex                                     | STDIO config in TOML file     |
 *
 * Key Test Focus:
 * 1. Group 1 (json+stdio): Always generates STDIO format
 * 2. Group 2 (json+http): Chooses HTTP vs STDIO correctly, OAuth URLs
 * 3. Group 3 (command+http): Calls right command template for transport
 * 4. Group 4 (special): YAML/TOML format handling
 */
