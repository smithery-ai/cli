import { existsSync, readFileSync } from "node:fs"
import { beforeEach, describe, expect, test, vi } from "vitest"

vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
}))

// Mock process.exit to throw instead of exiting
vi.spyOn(process, "exit").mockImplementation((code) => {
	throw new Error(`process.exit(${code})`)
})

// Suppress console.error in tests
vi.spyOn(console, "error").mockImplementation(() => {})

import { parseConfigSchema } from "../cli-utils"

describe("parseConfigSchema", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("parses inline JSON string", () => {
		const schema = { type: "object", properties: { key: { type: "string" } } }

		const result = parseConfigSchema(JSON.stringify(schema))

		expect(result).toEqual(schema)
		expect(existsSync).not.toHaveBeenCalled()
	})

	test("reads and parses .json file when it exists", () => {
		const schema = {
			type: "object",
			properties: { apiKey: { type: "string" } },
		}
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(schema))

		const result = parseConfigSchema("./config-schema.json")

		expect(existsSync).toHaveBeenCalledWith("./config-schema.json")
		expect(readFileSync).toHaveBeenCalledWith("./config-schema.json", "utf-8")
		expect(result).toEqual(schema)
	})

	test("exits with error when .json file does not exist", () => {
		vi.mocked(existsSync).mockReturnValue(false)

		expect(() => parseConfigSchema("./missing.json")).toThrow("process.exit(1)")
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Config schema file not found"),
		)
	})

	test("exits with error for invalid JSON", () => {
		expect(() => parseConfigSchema("{invalid}")).toThrow("process.exit(1)")
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Error parsing config schema"),
		)
	})

	test("exits with error when parsed value is not an object", () => {
		// Arrays are valid JSON but not objects
		expect(() => parseConfigSchema("[1, 2, 3]")).toThrow("process.exit(1)")
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("must be a JSON object"),
		)
	})

	test("handles Windows single-quote wrapping", () => {
		const schema = { type: "object" }

		const result = parseConfigSchema(`'${JSON.stringify(schema)}'`)

		expect(result).toEqual(schema)
	})

	test("handles double-encoded JSON strings", () => {
		const schema = { type: "object" }
		const doubleEncoded = JSON.stringify(JSON.stringify(schema))

		const result = parseConfigSchema(doubleEncoded)

		expect(result).toEqual(schema)
	})
})
