/**
 * Integration tests for client-specific format transformations
 *
 * Tests read/write cycles for clients with custom formats:
 * - Goose (YAML with extensions key)
 * - OpenCode (JSON with mcp key)
 * - Windsurf (JSON with serverUrl field)
 * - Cline (JSON with streamableHttp type)
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { ClientDefinition } from "../../../config/clients"
import { readConfig, writeConfig } from "../../../lib/client-config-io"
import {
	clineHttpConfig,
	clineJsonWithExistingServer,
	clineJsonWithStreamableHttp,
	gooseHttpConfig,
	gooseStdioConfig,
	gooseYamlWithExistingServer,
	gooseYamlWithHttpServer,
	gooseYamlWithOtherTopLevelKeys,
	gooseYamlWithStdioServer,
	opencodeHttpConfig,
	opencodeJsonWithExistingServer,
	opencodeJsonWithHttpServer,
	opencodeJsonWithOtherFields,
	opencodeJsonWithStdioServer,
	opencodeSimpleStdioConfig,
	opencodeStdioConfig,
	windsurfHttpConfig,
	windsurfJsonWithExistingServer,
	windsurfJsonWithServerUrl,
} from "./fixtures/client-configs"

// Mock getClientConfiguration to return test configs
vi.mock("../../../config/clients", async () => {
	const actual = await vi.importActual("../../../config/clients")
	return {
		...actual,
		getClientConfiguration: vi.fn(),
	}
})

// Mock verbose logger
vi.mock("../../../lib/logger", () => ({
	verbose: vi.fn(),
}))

// Import after mocking
import { getClientConfiguration } from "../../../config/clients"

const mockGetClientConfiguration = vi.mocked(getClientConfiguration)

// Helper functions to create mock ClientDefinition objects
function mockGooseClient(configPath: string): ClientDefinition {
	return {
		label: "Goose",
		install: { method: "file", format: "yaml", path: configPath },
		transports: {
			stdio: { typeValue: "stdio" },
			http: { supportsOAuth: true },
		},
		format: {
			topLevelKey: "extensions",
			fieldMappings: { command: "cmd", env: "envs" },
		},
	}
}

function mockOpencodeClient(configPath: string): ClientDefinition {
	return {
		label: "OpenCode",
		install: { method: "file", format: "json", path: configPath },
		transports: {
			stdio: { typeValue: "local", commandFormat: "array" },
			http: { typeValue: "remote", supportsOAuth: true },
		},
		format: {
			topLevelKey: "mcp",
			fieldMappings: { env: "environment" },
		},
	}
}

function mockWindsurfClient(configPath: string): ClientDefinition {
	return {
		label: "Windsurf",
		install: { method: "file", format: "json", path: configPath },
		transports: { stdio: {}, http: { supportsOAuth: true } },
		format: { fieldMappings: { url: "serverUrl" } },
	}
}

function mockClineClient(configPath: string): ClientDefinition {
	return {
		label: "Cline",
		install: { method: "file", format: "json", path: configPath },
		transports: {
			stdio: {},
			http: { typeValue: "streamableHttp", supportsOAuth: true },
		},
	}
}

describe("goose client", () => {
	let tempDir: string

	beforeEach(() => {
		vi.clearAllMocks()
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-config-test-"))
	})

	test("should read goose config with extensions key", () => {
		// ARRANGE: Goose config with extensions key
		const configPath = path.join(tempDir, "goose.yaml")
		fs.writeFileSync(configPath, gooseYamlWithStdioServer)

		mockGetClientConfiguration.mockReturnValue(mockGooseClient(configPath))

		// ACT
		const result = readConfig("goose")

		// ASSERT: Should read and transform goose format to standard format
		expect(result.mcpServers.github).toEqual({
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-github"],
			env: {
				GITHUB_PERSONAL_ACCESS_TOKEN: "<YOUR_TOKEN>",
			},
		})
		// STDIO configs in standard format don't have a type field
		expect(result.mcpServers.github).not.toHaveProperty("type")
		// Should not include goose-specific metadata fields
		expect(result.mcpServers.github).not.toHaveProperty("name")
		expect(result.mcpServers.github).not.toHaveProperty("enabled")
		expect(result.mcpServers.github).not.toHaveProperty("timeout")
	})

	test("should read goose config with HTTP server", () => {
		// ARRANGE: Goose config with HTTP server
		const configPath = path.join(tempDir, "goose.yaml")
		fs.writeFileSync(configPath, gooseYamlWithHttpServer)

		mockGetClientConfiguration.mockReturnValue(mockGooseClient(configPath))

		// ACT
		const result = readConfig("goose")

		// ASSERT: Should read HTTP server config
		expect(result.mcpServers["test-server"]).toMatchObject({
			type: "http",
			url: "https://server.smithery.ai/@test/server/mcp",
		})
		// Should not include STDIO-specific fields for HTTP configs
		expect(result.mcpServers["test-server"]).not.toHaveProperty("command")
		expect(result.mcpServers["test-server"]).not.toHaveProperty("args")
		expect(result.mcpServers["test-server"]).not.toHaveProperty("env")
	})

	test("should write goose config with proper format transformation", () => {
		// ARRANGE: Standard format config
		const configPath = path.join(tempDir, "goose.yaml")
		const config = gooseStdioConfig

		mockGetClientConfiguration.mockReturnValue(mockGooseClient(configPath))

		// ACT
		writeConfig(config, "goose")

		// ASSERT: File should be created with goose format
		expect(fs.existsSync(configPath)).toBe(true)
		const content = fs.readFileSync(configPath, "utf8")
		expect(content).toContain("extensions:")
		expect(content).toContain("github:")
		expect(content).toContain("cmd: npx")
		expect(content).toContain("type: stdio")
		expect(content).toContain("envs:")
		expect(content).toContain("GITHUB_PERSONAL_ACCESS_TOKEN")
		// Should NOT contain metadata fields
		expect(content).not.toContain("name:")
		expect(content).not.toContain("enabled:")
		expect(content).not.toContain("timeout:")

		// Verify by reading back
		const written = readConfig("goose")
		expect(written.mcpServers.github).toEqual({
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-github"],
			env: {
				GITHUB_PERSONAL_ACCESS_TOKEN: "<YOUR_TOKEN>",
			},
		})
	})

	test("should write goose config with HTTP server", () => {
		// ARRANGE: Standard format HTTP config
		const configPath = path.join(tempDir, "goose.yaml")
		const config = gooseHttpConfig

		mockGetClientConfiguration.mockReturnValue(mockGooseClient(configPath))

		// ACT
		writeConfig(config, "goose")

		// ASSERT: File should contain HTTP server in goose format
		expect(fs.existsSync(configPath)).toBe(true)
		const content = fs.readFileSync(configPath, "utf8")
		expect(content).toContain("extensions:")
		expect(content).toContain("test-server:")
		expect(content).toContain("type: http")
		expect(content).toContain("url:")
		// Should NOT contain metadata fields
		expect(content).not.toContain("name:")
		expect(content).not.toContain("enabled:")
		expect(content).not.toContain("timeout:")

		// Verify by reading back
		const written = readConfig("goose")
		expect(written.mcpServers["test-server"]).toEqual({
			type: "http",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {},
		})
	})

	test("should merge existing goose configs", () => {
		// ARRANGE: Existing goose config
		const configPath = path.join(tempDir, "goose.yaml")
		fs.writeFileSync(configPath, gooseYamlWithExistingServer)

		mockGetClientConfiguration.mockReturnValue(mockGooseClient(configPath))

		// ACT: Read, add server, write
		const config = readConfig("goose")
		config.mcpServers["new-server"] = {
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "new-server"],
		}
		writeConfig(config, "goose")

		// ASSERT: Both servers should be present
		const written = readConfig("goose")
		expect(written.mcpServers["existing-server"]).toBeDefined()
		expect(written.mcpServers["new-server"]).toBeDefined()
		expect(written.mcpServers["existing-server"]).toEqual({
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "existing-server"],
		})
		// STDIO configs in standard format don't have a type field
		expect(written.mcpServers["existing-server"]).not.toHaveProperty("type")
		expect(written.mcpServers["new-server"]).toEqual({
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "new-server"],
		})
	})

	test("should preserve other top-level keys in goose config", () => {
		// ARRANGE: Goose config with other top-level keys
		const configPath = path.join(tempDir, "goose.yaml")
		fs.writeFileSync(configPath, gooseYamlWithOtherTopLevelKeys)

		mockGetClientConfiguration.mockReturnValue(mockGooseClient(configPath))

		// ACT: Read, modify, write
		const config = readConfig("goose")
		config.mcpServers["new-server"] = {
			command: "npx",
			args: ["test"],
		}
		writeConfig(config, "goose")

		// ASSERT: Other top-level keys should be preserved
		const content = fs.readFileSync(configPath, "utf8")
		expect(content).toContain("someOtherField: preserved-value")
	})
})

describe("opencode client", () => {
	let tempDir: string

	beforeEach(() => {
		vi.clearAllMocks()
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-config-test-"))
	})

	test("should read OpenCode config with mcp key", () => {
		// ARRANGE: OpenCode config with mcp key
		const configPath = path.join(tempDir, "opencode.json")
		fs.writeFileSync(
			configPath,
			JSON.stringify(opencodeJsonWithStdioServer, null, 2),
		)

		mockGetClientConfiguration.mockReturnValue(mockOpencodeClient(configPath))

		// ACT
		const result = readConfig("opencode")

		// ASSERT: Should read and transform OpenCode format to standard format
		expect(result.mcpServers["github-server"]).toEqual({
			command: "npx",
			args: ["-y", "@test/server"],
			env: {
				API_KEY: "test-key",
			},
		})
		// STDIO configs in standard format don't have a type field
		expect(result.mcpServers["github-server"]).not.toHaveProperty("type")
	})

	test("should read OpenCode config with HTTP server", () => {
		// ARRANGE: OpenCode config with HTTP server
		const configPath = path.join(tempDir, "opencode.json")
		fs.writeFileSync(
			configPath,
			JSON.stringify(opencodeJsonWithHttpServer, null, 2),
		)

		mockGetClientConfiguration.mockReturnValue(mockOpencodeClient(configPath))

		// ACT
		const result = readConfig("opencode")

		// ASSERT: Should read HTTP server config and transform remote → http
		expect(result.mcpServers["test-server"]).toEqual({
			type: "http",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {
				Authorization: "Bearer token",
			},
		})
	})

	test("should write OpenCode config with STDIO server", () => {
		// ARRANGE: Standard format STDIO config
		const configPath = path.join(tempDir, "opencode.json")
		const config = opencodeStdioConfig

		mockGetClientConfiguration.mockReturnValue(mockOpencodeClient(configPath))

		// ACT
		writeConfig(config, "opencode")

		// ASSERT: File should be created with OpenCode format
		expect(fs.existsSync(configPath)).toBe(true)
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.mcp).toBeDefined()
		expect(written.mcp["github-server"]).toEqual({
			type: "local",
			command: ["npx", "-y", "@test/server"],
			environment: {
				API_KEY: "test-key",
			},
		})
		expect(written.mcpServers).toBeUndefined()
	})

	test("should write OpenCode config with HTTP server", () => {
		// ARRANGE: Standard format HTTP config
		const configPath = path.join(tempDir, "opencode.json")
		const config = opencodeHttpConfig

		mockGetClientConfiguration.mockReturnValue(mockOpencodeClient(configPath))

		// ACT
		writeConfig(config, "opencode")

		// ASSERT: File should contain HTTP server in OpenCode format
		expect(fs.existsSync(configPath)).toBe(true)
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.mcp["test-server"]).toEqual({
			type: "remote",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {
				Authorization: "Bearer token",
			},
		})
	})

	test("should write OpenCode config with command only (no args)", () => {
		// ARRANGE: Standard format STDIO config without args
		const configPath = path.join(tempDir, "opencode.json")
		const config = opencodeSimpleStdioConfig

		mockGetClientConfiguration.mockReturnValue(mockOpencodeClient(configPath))

		// ACT
		writeConfig(config, "opencode")

		// ASSERT: Should create array with just command
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.mcp["simple-server"]).toEqual({
			type: "local",
			command: ["npx"],
			environment: {
				KEY: "value",
			},
		})
	})

	test("should merge existing OpenCode configs", () => {
		// ARRANGE: Existing OpenCode config
		const configPath = path.join(tempDir, "opencode.json")
		fs.writeFileSync(
			configPath,
			JSON.stringify(opencodeJsonWithExistingServer, null, 2),
		)

		mockGetClientConfiguration.mockReturnValue(mockOpencodeClient(configPath))

		// ACT: Read, add server, write
		const config = readConfig("opencode")
		config.mcpServers["new-server"] = {
			command: "npx",
			args: ["-y", "@test/new"],
		}
		writeConfig(config, "opencode")

		// ASSERT: Both servers should be present, other fields preserved
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.mcp["existing-server"]).toBeDefined()
		expect(written.mcp["new-server"]).toBeDefined()
		expect(written.theme).toBe("dark")
	})

	test("should preserve other top-level fields in OpenCode config", () => {
		// ARRANGE: OpenCode config with other fields
		const configPath = path.join(tempDir, "opencode.json")
		fs.writeFileSync(
			configPath,
			JSON.stringify(opencodeJsonWithOtherFields, null, 2),
		)

		mockGetClientConfiguration.mockReturnValue(mockOpencodeClient(configPath))

		// ACT: Read, modify, write
		const config = readConfig("opencode")
		config.mcpServers["new-server"] = {
			command: "npx",
			args: ["test"],
		}
		writeConfig(config, "opencode")

		// ASSERT: Other fields should be preserved
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.theme).toBe("light")
		expect(written.model).toBe("anthropic/claude-3")
	})
})

describe("windsurf client", () => {
	let tempDir: string

	beforeEach(() => {
		vi.clearAllMocks()
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-config-test-"))
	})

	test("should read Windsurf config with serverUrl field", () => {
		// ARRANGE: Windsurf config with serverUrl
		const configPath = path.join(tempDir, "windsurf.json")
		fs.writeFileSync(
			configPath,
			JSON.stringify(windsurfJsonWithServerUrl, null, 2),
		)

		mockGetClientConfiguration.mockReturnValue(mockWindsurfClient(configPath))

		// ACT
		const result = readConfig("windsurf")

		// ASSERT: Should transform serverUrl → url
		expect(result.mcpServers["test-server"]).toEqual({
			type: "http",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {},
		})
		expect(result.mcpServers["test-server"]).not.toHaveProperty("serverUrl")
	})

	test("should write Windsurf config with serverUrl field", () => {
		// ARRANGE: Standard format HTTP config
		const configPath = path.join(tempDir, "windsurf.json")
		const config = windsurfHttpConfig

		mockGetClientConfiguration.mockReturnValue(mockWindsurfClient(configPath))

		// ACT
		writeConfig(config, "windsurf")

		// ASSERT: HTTP config should be written with serverUrl key (not url)
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.mcpServers["test-server"]).toEqual({
			type: "http",
			serverUrl: "https://server.smithery.ai/@test/server/mcp",
			headers: {},
		})
		expect(written.mcpServers["test-server"].url).toBeUndefined()
	})

	test("should handle read-modify-write cycle for Windsurf", () => {
		// ARRANGE: Existing Windsurf config
		const configPath = path.join(tempDir, "windsurf.json")
		fs.writeFileSync(
			configPath,
			JSON.stringify(windsurfJsonWithExistingServer, null, 2),
		)

		mockGetClientConfiguration.mockReturnValue(mockWindsurfClient(configPath))

		// ACT: Read, modify, write
		const config = readConfig("windsurf")
		config.mcpServers["new-server"] = {
			type: "http",
			url: "https://server.smithery.ai/@new/mcp",
			headers: {},
		}
		writeConfig(config, "windsurf")

		// ASSERT: Both servers present, other fields preserved
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.mcpServers["existing-server"]).toBeDefined()
		expect(written.mcpServers["new-server"]).toBeDefined()
		expect(written.mcpServers["new-server"].serverUrl).toBe(
			"https://server.smithery.ai/@new/mcp",
		)
		expect(written.someOtherField).toBe("preserved")
	})
})

describe("cline client", () => {
	let tempDir: string

	beforeEach(() => {
		vi.clearAllMocks()
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-config-test-"))
	})

	test("should read Cline config with streamableHttp type", () => {
		// ARRANGE: Cline config with streamableHttp
		const configPath = path.join(tempDir, "cline.json")
		fs.writeFileSync(
			configPath,
			JSON.stringify(clineJsonWithStreamableHttp, null, 2),
		)

		mockGetClientConfiguration.mockReturnValue(mockClineClient(configPath))

		// ACT
		const result = readConfig("cline")

		// ASSERT: Should transform streamableHttp → http
		expect(result.mcpServers["test-server"]).toEqual({
			type: "http",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {},
		})
	})

	test("should write Cline config with streamableHttp type", () => {
		// ARRANGE: Standard format HTTP config
		const configPath = path.join(tempDir, "cline.json")
		const config = clineHttpConfig

		mockGetClientConfiguration.mockReturnValue(mockClineClient(configPath))

		// ACT
		writeConfig(config, "cline")

		// ASSERT: HTTP config should be written with streamableHttp type (not http)
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.mcpServers["test-server"]).toEqual({
			type: "streamableHttp",
			url: "https://server.smithery.ai/@test/server/mcp",
			headers: {},
		})
		expect(written.mcpServers["test-server"].type).toBe("streamableHttp")
	})

	test("should handle read-modify-write cycle for Cline", () => {
		// ARRANGE: Existing Cline config
		const configPath = path.join(tempDir, "cline.json")
		fs.writeFileSync(
			configPath,
			JSON.stringify(clineJsonWithExistingServer, null, 2),
		)

		mockGetClientConfiguration.mockReturnValue(mockClineClient(configPath))

		// ACT: Read, modify, write
		const config = readConfig("cline")
		config.mcpServers["new-server"] = {
			type: "http",
			url: "https://server.smithery.ai/@new/mcp",
			headers: {},
		}
		writeConfig(config, "cline")

		// ASSERT: Both servers present, other fields preserved
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.mcpServers["existing-server"]).toBeDefined()
		expect(written.mcpServers["new-server"]).toBeDefined()
		expect(written.mcpServers["new-server"].type).toBe("streamableHttp")
		expect(written.someOtherField).toBe("preserved")
	})
})
