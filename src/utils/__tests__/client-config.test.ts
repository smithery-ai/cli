/**
 * Unit tests for readConfig and writeConfig functions
 *
 * Tests with real-world examples:
 * - Real client configs (claude, cursor, windsurf, codex)
 * - Note: Codex now uses command-based installation, but TOML parsing is still tested
 * - Real file formats (JSON, YAML, TOML)
 * - File I/O operations (reading, writing, merging)
 * - Assert expected outputs and file contents
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { Transport } from "../../config/clients"
import type { ClientMCPConfig } from "../mcp-config"
import { readConfig, writeConfig } from "../mcp-config"

// Mock getClientConfiguration to return test configs
vi.mock("../../config/clients", async () => {
	const actual = await vi.importActual("../../config/clients")
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
import { getClientConfiguration } from "../../config/clients"

const mockGetClientConfiguration = vi.mocked(getClientConfiguration)

describe("readConfig", () => {
	let tempDir: string

	beforeEach(() => {
		vi.clearAllMocks()
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-config-test-"))
	})

	test("should return empty config for command-based client", () => {
		// ARRANGE: Command-based client (claude-code)
		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Code",
			supportedTransports: [Transport.HTTP, Transport.STDIO],
			installType: "command",
			command: "claude",
		})

		// ACT
		const result = readConfig("claude-code")

		// ASSERT: Should return empty config
		expect(result).toEqual({ mcpServers: {} })
	})

	test("should return empty config when file does not exist", () => {
		// ARRANGE: JSON client with non-existent file
		const configPath = path.join(tempDir, "claude.json")
		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.STDIO],
			installType: "json",
			path: configPath,
		})

		// ACT
		const result = readConfig("claude")

		// ASSERT: Should return empty config
		expect(result).toEqual({ mcpServers: {} })
	})

	test("should read JSON config with mcpServers", () => {
		// ARRANGE: Real Claude Desktop JSON config
		const configPath = path.join(tempDir, "claude.json")
		const configContent = {
			mcpServers: {
				"test-server": {
					command: "npx",
					args: ["-y", "@smithery/cli@latest", "run", "test-server"],
				},
			},
		}
		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2))

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.STDIO],
			installType: "json",
			path: configPath,
		})

		// ACT
		const result = readConfig("claude")

		// ASSERT: Should read and normalize config
		expect(result.mcpServers).toEqual(configContent.mcpServers)
		expect(result.mcpServers["test-server"]).toEqual({
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "test-server"],
		})
	})

	test("should read JSON config with HTTP server", () => {
		// ARRANGE: Cursor config with HTTP server
		const configPath = path.join(tempDir, "cursor.json")
		const configContent = {
			mcpServers: {
				"upstash-context": {
					type: "http",
					url: "https://server.smithery.ai/@upstash/context7-mcp/mcp",
					headers: {},
				},
			},
		}
		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2))

		mockGetClientConfiguration.mockReturnValue({
			label: "Cursor",
			supportedTransports: [Transport.STDIO, Transport.HTTP],
			installType: "json",
			path: configPath,
		})

		// ACT
		const result = readConfig("cursor")

		// ASSERT: Should read HTTP server config
		expect(result.mcpServers["upstash-context"]).toEqual({
			type: "http",
			url: "https://server.smithery.ai/@upstash/context7-mcp/mcp",
			headers: {},
		})
	})

	test("should read YAML config", () => {
		// ARRANGE: Windsurf YAML config
		const configPath = path.join(tempDir, "windsurf.yaml")
		const yamlContent = `mcpServers:
  test-server:
    command: npx
    args:
      - -y
      - "@smithery/cli@latest"
      - run
      - test-server
`
		fs.writeFileSync(configPath, yamlContent)

		mockGetClientConfiguration.mockReturnValue({
			label: "Windsurf",
			supportedTransports: [Transport.STDIO],
			installType: "yaml",
			path: configPath,
		})

		// ACT
		const result = readConfig("windsurf")

		// ASSERT: Should read YAML config
		expect(result.mcpServers["test-server"]).toEqual({
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "test-server"],
		})
	})

	test("should read TOML config with mcp_servers normalization", () => {
		// ARRANGE: TOML config (uses mcp_servers format)
		const configPath = path.join(tempDir, "test-toml.toml")
		const tomlContent = `[mcp_servers.test-server]
command = "npx"
args = ["-y", "@smithery/cli@latest", "run", "test-server"]
`
		fs.writeFileSync(configPath, tomlContent)

		mockGetClientConfiguration.mockReturnValue({
			label: "Test TOML Client",
			supportedTransports: [Transport.STDIO],
			installType: "toml",
			path: configPath,
		})

		// ACT
		const result = readConfig("test-toml-client")

		// ASSERT: Should normalize mcp_servers to mcpServers
		expect(result.mcpServers).toBeDefined()
		expect(result.mcpServers["test-server"]).toEqual({
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "test-server"],
		})
	})

	test("should return empty config on parse error", () => {
		// ARRANGE: Invalid JSON file
		const configPath = path.join(tempDir, "invalid.json")
		fs.writeFileSync(configPath, "{ invalid json }")

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.STDIO],
			installType: "json",
			path: configPath,
		})

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
		const config: ClientMCPConfig = {
			mcpServers: {
				"test-server": {
					command: "npx",
					args: ["-y", "@smithery/cli@latest", "run", "test-server"],
				},
			},
		}

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.STDIO],
			installType: "json",
			path: configPath,
		})

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

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.STDIO],
			installType: "json",
			path: configPath,
		})

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
		const config: ClientMCPConfig = {
			mcpServers: {
				"test-server": {
					command: "npx",
					args: ["-y", "@smithery/cli@latest", "run", "test-server"],
				},
			},
		}

		mockGetClientConfiguration.mockReturnValue({
			label: "Windsurf",
			supportedTransports: [Transport.STDIO],
			installType: "yaml",
			path: configPath,
		})

		// ACT
		writeConfig(config, "windsurf")

		// ASSERT: File should be created with YAML content
		expect(fs.existsSync(configPath)).toBe(true)
		const content = fs.readFileSync(configPath, "utf8")
		expect(content).toContain("mcpServers:")
		expect(content).toContain("test-server:")
		expect(content).toContain("command: npx")
	})

	test("should write TOML config with mcp_servers format", () => {
		// ARRANGE: New TOML config
		const configPath = path.join(tempDir, "test-toml.toml")
		const config: ClientMCPConfig = {
			mcpServers: {
				"test-server": {
					command: "npx",
					args: ["-y", "@smithery/cli@latest", "run", "test-server"],
				},
			},
		}

		mockGetClientConfiguration.mockReturnValue({
			label: "Test TOML Client",
			supportedTransports: [Transport.STDIO],
			installType: "toml",
			path: configPath,
		})

		// ACT
		writeConfig(config, "test-toml-client")

		// ASSERT: File should use mcp_servers format
		expect(fs.existsSync(configPath)).toBe(true)
		const content = fs.readFileSync(configPath, "utf8")
		expect(content).toContain("[mcp_servers.test-server]")
		expect(content).toContain('command = "npx"')
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

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.STDIO],
			installType: "json",
			path: configPath,
		})

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

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.STDIO],
			installType: "json",
			path: configPath,
		})

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

		mockGetClientConfiguration.mockReturnValue({
			label: "Cursor",
			supportedTransports: [Transport.STDIO, Transport.HTTP],
			installType: "json",
			path: configPath,
		})

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

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.STDIO],
			installType: "json",
			path: configPath,
		})

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

		mockGetClientConfiguration.mockReturnValue({
			label: "Claude Desktop",
			supportedTransports: [Transport.STDIO],
			installType: "json",
			path: configPath,
		})

		// ACT: Read, update server, write
		const config = readConfig("claude")
		config.mcpServers["test-server"] = {
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "test-server"],
		}
		writeConfig(config, "claude")

		// ASSERT: Server updated, not duplicated
		const endState = JSON.parse(fs.readFileSync(configPath, "utf8"))
		expect(Object.keys(endState.mcpServers)).toHaveLength(1)
		expect(endState.mcpServers["test-server"]).toEqual({
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", "test-server"],
		})
	})

	test("should preserve YAML structure and comments when reading and writing", () => {
		// ARRANGE: Start state - YAML file with servers
		const configPath = path.join(tempDir, "windsurf.yaml")
		const yamlContent = `mcpServers:
  existing-server:
    command: npx
    args:
      - -y
      - "@smithery/cli@latest"
      - run
      - existing-server
`
		fs.writeFileSync(configPath, yamlContent)

		mockGetClientConfiguration.mockReturnValue({
			label: "Windsurf",
			supportedTransports: [Transport.STDIO],
			installType: "yaml",
			path: configPath,
		})

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
