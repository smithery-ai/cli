import { describe, expect, test } from "vitest"
import {
	transformFromStandard,
	transformToStandard,
} from "../../../lib/client-config-io"
import {
	transformFromStandardCases,
	transformToStandardCases,
} from "./fixtures/format-transformations"

describe("transformToStandard", () => {
	for (const testCase of transformToStandardCases) {
		test(testCase.name, () => {
			// ARRANGE: Test case is already set up with input and descriptor
			const { input, expected, descriptor } = testCase

			// ACT: Transform client format to standard format
			const result = transformToStandard(input, descriptor)

			// ASSERT: Result matches expected standard format
			expect(result).toEqual(expected)
		})
	}

	test("should handle HTTP detection by URL field presence", () => {
		// ARRANGE: Config with URL field but no explicit type
		const input = {
			serverUrl: "https://server.example.com/mcp",
		}
		const descriptor = {
			topLevelKey: "mcpServers",
			fieldMappings: {
				http: { url: "serverUrl" },
			},
		}

		// ACT
		const result = transformToStandard(input, descriptor)

		// ASSERT: Should be detected as HTTP config
		expect(result).toEqual({
			type: "http",
			url: "https://server.example.com/mcp",
		})
	})

	test("should handle STDIO detection by command field presence", () => {
		// ARRANGE: Config with command field but no explicit type
		const input = {
			cmd: "npx",
			args: ["test"],
		}
		const descriptor = {
			topLevelKey: "mcpServers",
			fieldMappings: {
				stdio: { command: "cmd" },
			},
		}

		// ACT
		const result = transformToStandard(input, descriptor)

		// ASSERT: Should be detected as STDIO config
		expect(result).toEqual({
			command: "npx",
			args: ["test"],
		})
	})
})

describe("transformFromStandard", () => {
	for (const testCase of transformFromStandardCases) {
		test(testCase.name, () => {
			// ARRANGE: Test case is already set up with input, descriptor, and serverName
			const { input, expected, descriptor, serverName = "test-server" } =
				testCase

			// ACT: Transform standard format to client format
			const result = transformFromStandard(input, descriptor, serverName)

			// ASSERT: Result matches expected client format
			expect(result).toEqual(expected)
		})
	}

	test("should handle STDIO config without optional args field", () => {
		// ARRANGE: Standard STDIO config without args
		const input = {
			command: "npx",
			env: {
				KEY: "value",
			},
		}
		const descriptor = {
			topLevelKey: "mcpServers",
			fieldMappings: {
				stdio: { command: "cmd", env: "envs" },
			},
			typeTransformations: {
				stdio: { typeValue: "stdio" },
			},
		}

		// ACT
		const result = transformFromStandard(input, descriptor, "test-server")

		// ASSERT: Should not include args field
		expect(result).toEqual({
			cmd: "npx",
			envs: {
				KEY: "value",
			},
			type: "stdio",
		})
		expect(result).not.toHaveProperty("args")
	})

	test("should handle STDIO config without optional env field", () => {
		// ARRANGE: Standard STDIO config without env
		const input = {
			command: "npx",
			args: ["-y", "@test/server"],
		}
		const descriptor = {
			topLevelKey: "mcpServers",
			fieldMappings: {
				stdio: { command: "cmd" },
			},
			typeTransformations: {
				stdio: { typeValue: "stdio" },
			},
		}

		// ACT
		const result = transformFromStandard(input, descriptor, "test-server")

		// ASSERT: Should not include env field
		expect(result).toEqual({
			cmd: "npx",
			args: ["-y", "@test/server"],
			type: "stdio",
		})
		expect(result).not.toHaveProperty("env")
	})

	test("should handle HTTP config without optional headers field", () => {
		// ARRANGE: Standard HTTP config without headers
		const input = {
			type: "http",
			url: "https://server.example.com/mcp",
		}
		const descriptor = {
			topLevelKey: "mcpServers",
		}

		// ACT
		const result = transformFromStandard(input, descriptor, "test-server")

		// ASSERT: Should not include headers field
		expect(result).toEqual({
			type: "http",
			url: "https://server.example.com/mcp",
		})
		expect(result).not.toHaveProperty("headers")
	})

	test("should handle OpenCode array format with empty args", () => {
		// ARRANGE: Standard STDIO config with empty args array
		const input = {
			command: "npx",
			args: [],
			env: {
				KEY: "value",
			},
		}
		const descriptor = {
			topLevelKey: "mcp",
			fieldMappings: {
				stdio: { env: "environment" },
			},
			typeTransformations: {
				stdio: { typeValue: "local" },
			},
			structureTransformations: {
				stdio: { commandFormat: "array" as const },
			},
		}

		// ACT
		const result = transformFromStandard(input, descriptor, "test-server")

		// ASSERT: Should create array with just command (no args)
		expect(result).toEqual({
			type: "local",
			command: ["npx"],
			environment: {
				KEY: "value",
			},
		})
		expect(result).not.toHaveProperty("args")
	})
})

