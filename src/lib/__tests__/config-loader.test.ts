/**
 * Config Loader Tests
 * Tests for loadProjectConfig function
 */

import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock node:fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
}))

import { existsSync, readFileSync } from "node:fs"
import { loadProjectConfig } from "../config-loader"

describe("loadProjectConfig", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("file doesn't exist: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(false)

		const result = loadProjectConfig()

		expect(result).toBeNull()
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).not.toHaveBeenCalled()
	})

	test("valid typescript config with name: returns parsed config", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(
			"runtime: typescript\nname: my-server-name\n",
		)

		const result = loadProjectConfig()

		expect(result).toEqual({
			runtime: "typescript",
			name: "my-server-name",
		})
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})

	test("valid typescript config without name: returns parsed config", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("runtime: typescript\n")

		const result = loadProjectConfig()

		expect(result).toEqual({
			runtime: "typescript",
		})
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})

	test("valid typescript config with optional fields: returns parsed config", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(
			"runtime: typescript\nname: my-server\ntarget: local\nenv:\n  KEY: value\n",
		)

		const result = loadProjectConfig()

		expect(result).toEqual({
			runtime: "typescript",
			name: "my-server",
			target: "local",
			env: {
				KEY: "value",
			},
		})
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})

	test("invalid YAML syntax: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(
			"runtime: typescript\nname: [unclosed\n",
		)

		const result = loadProjectConfig()

		expect(result).toBeNull()
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})

	test("valid YAML but invalid schema: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("runtime: invalid-runtime\n")

		const result = loadProjectConfig()

		expect(result).toBeNull()
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})

	test("file read error: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockImplementation(() => {
			throw new Error("File read error")
		})

		const result = loadProjectConfig()

		expect(result).toBeNull()
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})

	test("YAML parses to array: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("- item1\n- item2\n")

		const result = loadProjectConfig()

		expect(result).toBeNull()
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})

	test("YAML parses to primitive: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("just a string\n")

		const result = loadProjectConfig()

		expect(result).toBeNull()
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})

	test("invalid server name format: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(
			"runtime: typescript\nname: 123invalid\n",
		)

		const result = loadProjectConfig()

		expect(result).toBeNull()
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})

	test("server name too short: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("runtime: typescript\nname: ab\n")

		const result = loadProjectConfig()

		expect(result).toBeNull()
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})

	test("server name too long: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		const longName = `a${"b".repeat(40)}` // 41 characters
		vi.mocked(readFileSync).mockReturnValue(
			`runtime: typescript\nname: ${longName}\n`,
		)

		const result = loadProjectConfig()

		expect(result).toBeNull()
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})

	test("server name starts with number: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(
			"runtime: typescript\nname: 123server\n",
		)

		const result = loadProjectConfig()

		expect(result).toBeNull()
		expect(existsSync).toHaveBeenCalled()
		expect(readFileSync).toHaveBeenCalled()
	})
})
