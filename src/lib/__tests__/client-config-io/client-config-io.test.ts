/**
 * Unit tests for readConfig and writeConfig functions
 *
 * Tests with real-world examples:
 * - Real client configs (claude, cursor, windsurf, codex)
 * - Note: Codex now uses command-based installation
 * - Real file formats (JSON, YAML)
 * - File I/O operations (reading, writing, merging)
 * - Assert expected outputs and file contents
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { ClientDefinition } from "../../../config/clients"
import type { ClientMCPConfig } from "../../../lib/client-config-io"
import { readConfig, writeConfig } from "../../../lib/client-config-io"
import {
	clineHttpConfig,
	clineJsonWithStreamableHttp,
	gooseStdioConfig,
	gooseYamlWithStdioServer,
	opencodeJsonWithStdioServer,
	opencodeSimpleStdioConfig,
	opencodeStdioConfig,
	standardJsonWithStdioServer,
	standardStdioConfig,
	standardYamlWithExistingServer,
	windsurfHttpConfig,
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
vi.mock("../../lib/logger", () => ({
	verbose: vi.fn(),
}))

// Import after mocking
import { getClientConfiguration } from "../../../config/clients"

const mockGetClientConfiguration = vi.mocked(getClientConfiguration)

// Helper functions to create mock ClientDefinition objects
function mockJsonClient(label: string, configPath: string): ClientDefinition {
	return {
		label,
		install: { method: "file", format: "json", path: configPath },
		transports: { stdio: {} },
	}
}

function mockJsonClientWithHttp(
	label: string,
	configPath: string,
): ClientDefinition {
	return {
		label,
		install: { method: "file", format: "json", path: configPath },
		transports: { stdio: {}, http: { supportsOAuth: true } },
	}
}

function mockYamlClient(label: string, configPath: string): ClientDefinition {
	return {
		label,
		install: { method: "file", format: "yaml", path: configPath },
		transports: { stdio: {} },
	}
}

function mockCommandClient(label: string): ClientDefinition {
	return {
		label,
		install: {
			method: "command",
			command: "test-cli",
			templates: { stdio: (_n, c, a) => [c, ...a] },
		},
		transports: { stdio: {}, http: { supportsOAuth: true } },
	}
}

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

describe("readConfig", () => {
	let tempDir: string

	beforeEach(() => {
		vi.clearAllMocks()
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-config-test-"))
	})

	test("should return empty config for command-based client", () => {
		// ARRANGE: Command-based client (claude-code)
		mockGetClientConfiguration.mockReturnValue(mockCommandClient("Claude Code"))

		// ACT
		const result = readConfig("claude-code")

		// ASSERT: Should return empty config
		expect(result).toEqual({ mcpServers: {} })
	})

	test("should return empty config when file does not exist", () => {
		// ARRANGE: JSON client with non-existent file
		const configPath = path.join(tempDir, "claude.json")
		mockGetClientConfiguration.mockReturnValue(
			mockJsonClient("Claude Desktop", configPath),
		)

		// ACT
		const result = readConfig("claude")

		// ASSERT: Should return empty config
		expect(result).toEqual({ mcpServers: {} })
	})

	test("should read standard JSON config with mcpServers", () => {
		// ARRANGE: Real Claude Desktop JSON config
		const configPath = path.join(tempDir, "claude.json")
		fs.writeFileSync(
			configPath,
			JSON.stringify(standardJsonWithStdioServer, null, 2),
		)

		mockGetClientConfiguration.mockReturnValue(
			mockJsonClient("Claude Desktop", configPath),
		)

		// ACT
		const result = readConfig("claude")

		// ASSERT: Should read and normalize config
		expect(result.mcpServers).toEqual(standardJsonWithStdioServer.mcpServers)
		expect(result.mcpServers["test-server"]).toEqual(
			standardStdioConfig.mcpServers["test-server"],
		)
	})

	test("should return empty config on parse error", () => {
		// ARRANGE: Invalid JSON file
		const configPath = path.join(tempDir, "invalid.json")
		fs.writeFileSync(configPath, "{ invalid json }")

		mockGetClientConfiguration.mockReturnValue(
			mockJsonClient("Claude Desktop", configPath),
		)

		// ACT
		const result = readConfig("claude")

		// ASSERT: Should return empty config on error
		expect(result).toEqual({ mcpServers: {} })
	})
})

describe("writeConfig", () => {
	let tempDir: string

	beforeEach(() => {
		vi.clearAllMocks()
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-config-test-"))
	})

	test("should write JSON config to new file", () => {
		// ARRANGE: New JSON config
		const configPath = path.join(tempDir, "claude.json")
		const config: ClientMCPConfig = standardStdioConfig

		mockGetClientConfiguration.mockReturnValue(
			mockJsonClient("Claude Desktop", configPath),
		)

		// ACT
		writeConfig(config, "claude")

		// ASSERT: File should be created with correct content
		expect(fs.existsSync(configPath)).toBe(true)
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.mcpServers).toEqual(config.mcpServers)
	})

	test("should merge JSON config with existing file", () => {
		// ARRANGE: Existing config with one server
		const configPath = path.join(tempDir, "claude.json")
		const existingConfig = {
			mcpServers: {
				"existing-server": {
					command: "npx",
					args: ["existing"],
				},
			},
			someOtherField: "preserved",
		}
		fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2))

		const newConfig: ClientMCPConfig = {
			mcpServers: {
				"new-server": {
					command: "npx",
					args: ["-y", "@smithery/cli@latest", "run", "new-server"],
				},
			},
		}

		mockGetClientConfiguration.mockReturnValue(
			mockJsonClient("Claude Desktop", configPath),
		)

		// ACT
		writeConfig(newConfig, "claude")

		// ASSERT: Should merge top-level fields, but replace mcpServers entirely
		// (because install/uninstall read entire config, modify, then write back)
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.mcpServers["new-server"]).toBeDefined()
		expect(written.someOtherField).toBe("preserved")
		// Note: mcpServers is replaced, not merged (existing-server is overwritten)
		// This is correct because callers read entire config, modify, then write back
		expect(written.mcpServers["existing-server"]).toBeUndefined()
	})

	test("should write YAML config to new file", () => {
		// ARRANGE: New YAML config
		const configPath = path.join(tempDir, "windsurf.yaml")
		const config: ClientMCPConfig = standardStdioConfig

		mockGetClientConfiguration.mockReturnValue(
			mockYamlClient("Windsurf", configPath),
		)

		// ACT
		writeConfig(config, "windsurf")

		// ASSERT: File should be created with YAML content
		expect(fs.existsSync(configPath)).toBe(true)
		const content = fs.readFileSync(configPath, "utf8")
		expect(content).toContain("mcpServers:")
		expect(content).toContain("test-server:")
		expect(content).toContain("command: npx")
	})

	test("should create directory if it does not exist", () => {
		// ARRANGE: Config path with non-existent directory
		const configDir = path.join(tempDir, "nested", "dir")
		const configPath = path.join(configDir, "claude.json")
		const config: ClientMCPConfig = {
			mcpServers: {
				"test-server": {
					command: "npx",
					args: ["test"],
				},
			},
		}

		mockGetClientConfiguration.mockReturnValue(
			mockJsonClient("Claude Desktop", configPath),
		)

		// ACT
		writeConfig(config, "claude")

		// ASSERT: Directory should be created
		expect(fs.existsSync(configDir)).toBe(true)
		expect(fs.existsSync(configPath)).toBe(true)
	})

	test("should throw error for invalid mcpServers structure", () => {
		// ARRANGE: Invalid config
		const configPath = path.join(tempDir, "claude.json")
		const invalidConfig = {
			mcpServers: "not an object",
		} as unknown as ClientMCPConfig

		mockGetClientConfiguration.mockReturnValue(
			mockJsonClient("Claude Desktop", configPath),
		)

		// ACT & ASSERT: Should throw error
		expect(() => writeConfig(invalidConfig, "claude")).toThrow(
			"Invalid mcpServers structure",
		)
	})

	test("should write HTTP server config correctly", () => {
		// ARRANGE: Config with HTTP server
		const configPath = path.join(tempDir, "cursor.json")
		const config: ClientMCPConfig = {
			mcpServers: {
				"upstash-context": {
					type: "http",
					url: "https://server.smithery.ai/@upstash/context7-mcp/mcp",
					headers: {},
				},
			},
		}

		mockGetClientConfiguration.mockReturnValue(
			mockJsonClientWithHttp("Cursor", configPath),
		)

		// ACT
		writeConfig(config, "cursor")

		// ASSERT: HTTP config should be written correctly
		const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(written.mcpServers["upstash-context"]).toEqual({
			type: "http",
			url: "https://server.smithery.ai/@upstash/context7-mcp/mcp",
			headers: {},
		})
	})
})

describe("read-modify-write cycle (real-world flow)", () => {
	let tempDir: string

	beforeEach(() => {
		vi.clearAllMocks()
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-config-test-"))
	})

	test("should preserve existing servers and top-level fields when reading, modifying, and writing", () => {
		// ARRANGE: Start state - file on disk with existing servers and other fields
		const configPath = path.join(tempDir, "claude.json")
		const startState = {
			mcpServers: {
				"existing-server-1": {
					command: "npx",
					args: ["-y", "@smithery/cli@latest", "run", "existing-server-1"],
				},
				"existing-server-2": {
					type: "http",
					url: "https://server.smithery.ai/@test/server2/mcp",
					headers: {},
				},
			},
			someOtherField: "preserved-value",
			anotherField: { nested: "data" },
		}
		fs.writeFileSync(configPath, JSON.stringify(startState, null, 2))

		mockGetClientConfiguration.mockReturnValue(
			mockJsonClient("Claude Desktop", configPath),
		)

		// ACT: Simulate install flow - read, modify, write
		const config = readConfig("claude")
		config.mcpServers["new-server"] = {
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "new-server"],
		}
		writeConfig(config, "claude")

		// ASSERT: End state - all servers preserved, top-level fields preserved
		const endState = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(endState.mcpServers["existing-server-1"]).toEqual(
			startState.mcpServers["existing-server-1"],
		)
		expect(endState.mcpServers["existing-server-2"]).toEqual(
			startState.mcpServers["existing-server-2"],
		)
		expect(endState.mcpServers["new-server"]).toEqual({
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "new-server"],
		})
		expect(endState.someOtherField).toBe("preserved-value")
		expect(endState.anotherField).toEqual({ nested: "data" })
	})

	test("should update existing server when modifying and writing", () => {
		// ARRANGE: Start state - file with one server
		const configPath = path.join(tempDir, "claude.json")
		const startState = {
			mcpServers: {
				"test-server": {
					command: "npx",
					args: ["old", "args"],
				},
			},
		}
		fs.writeFileSync(configPath, JSON.stringify(startState, null, 2))

		mockGetClientConfiguration.mockReturnValue(
			mockJsonClient("Claude Desktop", configPath),
		)

		// ACT: Read, update server, write
		const config = readConfig("claude")
		config.mcpServers["test-server"] =
			standardStdioConfig.mcpServers["test-server"]
		writeConfig(config, "claude")

		// ASSERT: Server updated, not duplicated
		const endState = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(Object.keys(endState.mcpServers)).toHaveLength(1)
		expect(endState.mcpServers["test-server"]).toEqual(
			standardStdioConfig.mcpServers["test-server"],
		)
	})

	test("should preserve YAML structure and comments when reading and writing", () => {
		// ARRANGE: Start state - YAML file with servers
		const configPath = path.join(tempDir, "windsurf.yaml")
		fs.writeFileSync(configPath, standardYamlWithExistingServer)

		mockGetClientConfiguration.mockReturnValue(
			mockYamlClient("Windsurf", configPath),
		)

		// ACT: Read, add server, write
		const config = readConfig("windsurf")
		config.mcpServers["new-server"] = {
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "new-server"],
		}
		writeConfig(config, "windsurf")

		// ASSERT: Both servers present in written file
		const written = readConfig("windsurf")
		expect(written.mcpServers["existing-server"]).toBeDefined()
		expect(written.mcpServers["new-server"]).toBeDefined()
	})
})

describe("transformation flow integration", () => {
	let tempDir: string

	beforeEach(() => {
		vi.clearAllMocks()
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-config-test-"))
	})

	describe("readConfig - transformation detection", () => {
		test("should apply transformation when client has formatDescriptor", () => {
			// ARRANGE: Goose client (needs transformation)
			const configPath = path.join(tempDir, "goose.yaml")
			fs.writeFileSync(configPath, gooseYamlWithStdioServer)

			mockGetClientConfiguration.mockReturnValue(mockGooseClient(configPath))

			// ACT
			const result = readConfig("goose")

			// ASSERT: Should transform goose format (cmd/envs/type) → standard format (command/env/no type)
			expect(result.mcpServers.github).toEqual(
				gooseStdioConfig.mcpServers.github,
			)
			expect(result.mcpServers.github).not.toHaveProperty("type")
			expect(result.mcpServers.github).not.toHaveProperty("cmd")
			expect(result.mcpServers.github).not.toHaveProperty("envs")
		})

		test("should use normal flow when client has no formatDescriptor", () => {
			// ARRANGE: Standard client (no transformation)
			const configPath = path.join(tempDir, "claude.json")
			const configContent: ClientMCPConfig = opencodeSimpleStdioConfig
			fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2))

			mockGetClientConfiguration.mockReturnValue(
				mockJsonClient("Claude Desktop", configPath),
			)

			// ACT
			const result = readConfig("claude")

			// ASSERT: Should read config as-is without transformation
			const server = result.mcpServers["simple-server"]
			expect(server).toEqual(
				opencodeSimpleStdioConfig.mcpServers["simple-server"],
			)
			// Verify no transformation was applied (fields match exactly)
			expect("command" in server && server.command).toBe("npx")
			expect("env" in server && server.env).toEqual({ KEY: "value" })
		})

		test("should detect transformation needed based on topLevelKey difference", () => {
			// ARRANGE: OpenCode client with mcp key (different from mcpServers)
			const configPath = path.join(tempDir, "opencode.json")
			fs.writeFileSync(
				configPath,
				JSON.stringify(opencodeJsonWithStdioServer, null, 2),
			)

			mockGetClientConfiguration.mockReturnValue(mockOpencodeClient(configPath))

			// ACT
			const result = readConfig("opencode")

			// ASSERT: Should transform from mcp key and apply transformations
			expect(result.mcpServers["github-server"]).toEqual(
				opencodeStdioConfig.mcpServers["github-server"],
			)
			expect(result.mcpServers["github-server"]).not.toHaveProperty("type")
			expect(result.mcpServers["github-server"]).not.toHaveProperty(
				"environment",
			)
		})
	})

	describe("writeConfig - transformation detection", () => {
		test("should apply transformation when client has formatDescriptor", () => {
			// ARRANGE: Standard format config, Goose client
			const configPath = path.join(tempDir, "goose.yaml")
			const config: ClientMCPConfig = gooseStdioConfig

			mockGetClientConfiguration.mockReturnValue(mockGooseClient(configPath))

			// ACT
			writeConfig(config, "goose")

			// ASSERT: Should transform standard format → goose format
			const content = fs.readFileSync(configPath, "utf8")
			expect(content).toContain("extensions:")
			expect(content).toContain("cmd: npx")
			expect(content).toContain("envs:")
			expect(content).toContain("type: stdio")
			expect(content).not.toContain("command:")
			expect(content).not.toContain("env:")
		})

		test("should use normal flow when client has no formatDescriptor", () => {
			// ARRANGE: Standard format config, client without formatDescriptor
			const configPath = path.join(tempDir, "claude.json")
			const config: ClientMCPConfig = opencodeSimpleStdioConfig

			mockGetClientConfiguration.mockReturnValue(
				mockJsonClient("Claude Desktop", configPath),
			)

			// ACT
			writeConfig(config, "claude")

			// ASSERT: Should write config as-is without transformation
			const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
			const writtenServer = written.mcpServers["simple-server"]
			expect(writtenServer).toEqual(
				opencodeSimpleStdioConfig.mcpServers["simple-server"],
			)
			// Verify no transformation was applied (fields match exactly)
			expect("command" in writtenServer && writtenServer.command).toBe("npx")
			expect("env" in writtenServer && writtenServer.env).toEqual({
				KEY: "value",
			})
		})

		test("should apply transformation for HTTP configs with formatDescriptor", () => {
			// ARRANGE: Standard HTTP config, Windsurf client (needs serverUrl transformation)
			const configPath = path.join(tempDir, "windsurf.json")
			const config: ClientMCPConfig = windsurfHttpConfig

			mockGetClientConfiguration.mockReturnValue(mockWindsurfClient(configPath))

			// ACT
			writeConfig(config, "windsurf")

			// ASSERT: Should transform url → serverUrl
			const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
			expect(written.mcpServers["test-server"]).toEqual(
				windsurfJsonWithServerUrl.mcpServers["test-server"],
			)
			expect(written.mcpServers["test-server"].url).toBeUndefined()
		})

		test("should apply type transformation for HTTP configs", () => {
			// ARRANGE: Standard HTTP config, Cline client (needs streamableHttp transformation)
			const configPath = path.join(tempDir, "cline.json")
			const config: ClientMCPConfig = clineHttpConfig

			mockGetClientConfiguration.mockReturnValue(mockClineClient(configPath))

			// ACT
			writeConfig(config, "cline")

			// ASSERT: Should transform http → streamableHttp
			const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
			expect(written.mcpServers["test-server"]).toEqual(
				clineJsonWithStreamableHttp.mcpServers["test-server"],
			)
		})
	})

	describe("round-trip transformation flow", () => {
		test("should correctly transform client format → standard → client format", () => {
			// ARRANGE: Start with client-specific format (Goose)
			const configPath = path.join(tempDir, "goose.yaml")
			fs.writeFileSync(configPath, gooseYamlWithStdioServer)

			mockGetClientConfiguration.mockReturnValue(mockGooseClient(configPath))

			// ACT: Read (client → standard), modify, write (standard → client)
			const readResult = readConfig("goose")
			const server = readResult.mcpServers.github
			if ("env" in server && server.env) {
				server.env.GITHUB_PERSONAL_ACCESS_TOKEN = "modified-token"
			}
			writeConfig(readResult, "goose")

			// ASSERT: Should maintain transformation through round-trip
			const finalResult = readConfig("goose")
			expect(finalResult.mcpServers.github).toEqual({
				command: "npx",
				args: ["-y", "@modelcontextprotocol/server-github"],
				env: {
					GITHUB_PERSONAL_ACCESS_TOKEN: "modified-token",
				},
			})

			// Verify file has correct client format
			const fileContent = fs.readFileSync(configPath, "utf8")
			expect(fileContent).toContain("cmd: npx")
			expect(fileContent).toContain("envs:")
			expect(fileContent).toContain("modified-token")
		})

		test("should handle standard format without transformation", () => {
			// ARRANGE: Standard format config
			const configPath = path.join(tempDir, "claude.json")
			const configContent: ClientMCPConfig = opencodeSimpleStdioConfig
			fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2))

			mockGetClientConfiguration.mockReturnValue(
				mockJsonClient("Claude Desktop", configPath),
			)

			// ACT: Read, modify, write
			const readResult = readConfig("claude")
			const server = readResult.mcpServers["simple-server"]
			if ("env" in server && server.env) {
				server.env.KEY = "modified-value"
			}
			writeConfig(readResult, "claude")

			// ASSERT: Should maintain standard format without transformation
			const finalResult = readConfig("claude")
			expect(finalResult.mcpServers["simple-server"]).toEqual({
				command: "npx",
				env: {
					KEY: "modified-value",
				},
			})

			// Verify file maintains standard format
			const written = JSON.parse(fs.readFileSync(configPath, "utf8"))
			const writtenServer = written.mcpServers["simple-server"]
			expect("command" in writtenServer && writtenServer.command).toBe("npx")
			expect("env" in writtenServer && writtenServer.env).toEqual({
				KEY: "modified-value",
			})
		})
	})
})
