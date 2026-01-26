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

	test("valid config with target: returns parsed config", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("target: local\n")

		const result = loadProjectConfig()

		expect(result).toEqual({
			target: "local",
		})
	})

	test("valid config with build options: returns parsed config", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(
			"target: remote\nbuild:\n  installCommand: pnpm install\n  buildCommand: pnpm build\n  outputDirectory: dist\n",
		)

		const result = loadProjectConfig()

		expect(result).toEqual({
			target: "remote",
			build: {
				installCommand: "pnpm install",
				buildCommand: "pnpm build",
				outputDirectory: "dist",
			},
		})
	})

	test("valid config with assets: returns parsed config", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(
			"name: my-server\nbuild:\n  assets:\n    - data/**\n    - templates/**\n    - config.json\n",
		)

		const result = loadProjectConfig()

		expect(result).toEqual({
			name: "my-server",
			build: {
				assets: ["data/**", "templates/**", "config.json"],
			},
		})
	})

	test("passthrough allows unknown fields: returns config with extra fields", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(
			"target: local\nruntime: typescript\nname: my-server\n",
		)

		const result = loadProjectConfig()

		expect(result).toEqual({
			target: "local",
			runtime: "typescript",
			name: "my-server",
		})
	})

	test("empty config: returns empty object", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("{}\n")

		const result = loadProjectConfig()

		expect(result).toEqual({})
	})

	test("invalid YAML syntax: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("target: local\nname: [unclosed\n")

		const result = loadProjectConfig()

		expect(result).toBeNull()
	})

	test("invalid target value: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("target: invalid-target\n")

		const result = loadProjectConfig()

		expect(result).toBeNull()
	})

	test("file read error: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockImplementation(() => {
			throw new Error("File read error")
		})

		const result = loadProjectConfig()

		expect(result).toBeNull()
	})

	test("YAML parses to array: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("- item1\n- item2\n")

		const result = loadProjectConfig()

		expect(result).toBeNull()
	})

	test("YAML parses to primitive: returns null", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("just a string\n")

		const result = loadProjectConfig()

		expect(result).toBeNull()
	})
})
