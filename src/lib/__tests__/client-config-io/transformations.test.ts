import { describe, expect, test } from "vitest"
import { fromClientFormat, toClientFormat } from "../../../lib/client-config-io"
import {
	fromClientFormatCases,
	MOCK_CLIENTS,
	toClientFormatCases,
} from "./fixtures/format-transformations"

describe("fromClientFormat", () => {
	for (const testCase of fromClientFormatCases) {
		test(testCase.name, () => {
			// ARRANGE: Test case is already set up with input and client
			const { input, expected, client } = testCase

			// ACT: Transform client format to standard format
			const result = fromClientFormat(input, client)

			// ASSERT: Result matches expected standard format
			expect(result).toEqual(expected)
		})
	}

	test("should handle HTTP detection by URL field presence", () => {
		// ARRANGE: Config with URL field but no explicit type
		const input = {
			serverUrl: "https://server.example.com/mcp",
		}
		const client = MOCK_CLIENTS.windsurf()

		// ACT
		const result = fromClientFormat(input, client)

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
		const client = MOCK_CLIENTS.goose()

		// ACT
		const result = fromClientFormat(input, client)

		// ASSERT: Should be detected as STDIO config
		expect(result).toEqual({
			command: "npx",
			args: ["test"],
		})
	})
})

describe("toClientFormat", () => {
	for (const testCase of toClientFormatCases) {
		test(testCase.name, () => {
			// ARRANGE: Test case is already set up with input and client
			const { input, expected, client } = testCase

			// ACT: Transform standard format to client format
			const result = toClientFormat(input, client)

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
		const client = MOCK_CLIENTS.goose()

		// ACT
		const result = toClientFormat(input, client)

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
		const client = MOCK_CLIENTS.goose()

		// ACT
		const result = toClientFormat(input, client)

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
		const client = MOCK_CLIENTS.standard()

		// ACT
		const result = toClientFormat(input, client)

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
		const client = MOCK_CLIENTS.opencode()

		// ACT
		const result = toClientFormat(input, client)

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
