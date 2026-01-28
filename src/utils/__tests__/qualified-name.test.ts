import { describe, expect, test } from "vitest"
import { isValidNamespace, parseQualifiedName } from "../cli-utils"

describe("parseQualifiedName", () => {
	test.each([
		// [input, expectedNamespace, expectedServerName]
		["linear", "linear", ""],
		["myorg", "myorg", ""],
		["@linear", "linear", ""],
		["@foo/bar", "foo", "bar"],
		["foo/bar", "foo", "bar"],
		["@smithery/github", "smithery", "github"],
		["smithery/github", "smithery", "github"],
	])('parses "%s" as namespace="%s", serverName="%s"', (input, expectedNamespace, expectedServerName) => {
		const result = parseQualifiedName(input)

		expect(result.namespace).toBe(expectedNamespace)
		expect(result.serverName).toBe(expectedServerName)
	})

	test.each([
		"",
		"@",
		"@/bar",
		"/bar",
	])('throws error for invalid input "%s" with empty namespace', (input) => {
		expect(() => parseQualifiedName(input)).toThrow(
			"Invalid qualified name: namespace cannot be empty",
		)
	})
})

describe("isValidNamespace", () => {
	test("returns true for non-empty strings", () => {
		expect(isValidNamespace("foo")).toBe(true)
		expect(isValidNamespace("smithery")).toBe(true)
	})

	test("returns false for empty string", () => {
		expect(isValidNamespace("")).toBe(false)
	})
})
