import { describe, expect, test } from "vitest"
import { parseQualifiedName } from "../qualified-name"

describe("parseQualifiedName", () => {
	test.each([
		// [input, expectedNamespace, expectedServerName]
		["linear", "", "linear"],
		["myorg", "", "myorg"],
		["@foo/bar", "foo", "bar"],
		["foo/bar", "foo", "bar"],
		["@smithery/github", "smithery", "github"],
		["smithery/github", "smithery", "github"],
	])('parses "%s" as namespace="%s", serverName="%s"', (input, expectedNamespace, expectedServerName) => {
		const result = parseQualifiedName(input)

		expect(result.namespace).toBe(expectedNamespace)
		expect(result.serverName).toBe(expectedServerName)
	})

	test("throws error for empty input", () => {
		expect(() => parseQualifiedName("")).toThrow(
			"Invalid qualified name: cannot be empty",
		)
	})
})
