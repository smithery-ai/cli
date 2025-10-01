/**
 * Config to Args Converter Tests
 * Tests the conversion of config objects to dot-notation CLI arguments
 */

import { describe, expect, test } from "vitest"
import { convertConfigToDotArgs } from "../config-to-args"

describe("convertConfigToDotArgs", () => {
	test("handles primitive types and edge cases", () => {
		// Empty object
		expect(convertConfigToDotArgs({})).toEqual([])

		// String, number, boolean
		expect(convertConfigToDotArgs({ apiKey: "test-key-123" })).toEqual([
			"apiKey=test-key-123",
		])
		expect(convertConfigToDotArgs({ timeout: 5000 })).toEqual(["timeout=5000"])
		expect(convertConfigToDotArgs({ debug: true })).toEqual(["debug=true"])

		// Multiple primitives
		const multiResult = convertConfigToDotArgs({
			apiKey: "abc123",
			timeout: 3000,
			debug: false,
		})
		expect(multiResult).toContain("apiKey=abc123")
		expect(multiResult).toContain("timeout=3000")
		expect(multiResult).toContain("debug=false")
		expect(multiResult.length).toBe(3)

		// Null, undefined, zero, empty string
		const edgeCases = convertConfigToDotArgs({
			nullVal: null,
			undefinedVal: undefined,
			count: 0,
			emptyString: "",
			falsyBool: false,
		})
		expect(edgeCases).toContain("nullVal=null")
		expect(edgeCases).toContain("undefinedVal=undefined")
		expect(edgeCases).toContain("count=0")
		expect(edgeCases).toContain("emptyString=")
		expect(edgeCases).toContain("falsyBool=false")

		// Negative and floating point numbers
		const numbers = convertConfigToDotArgs({
			negative: -10,
			float: 0.7,
			negativeFloat: -5.5,
		})
		expect(numbers).toContain("negative=-10")
		expect(numbers).toContain("float=0.7")
		expect(numbers).toContain("negativeFloat=-5.5")

		// Special characters in strings
		const special = convertConfigToDotArgs({
			message: "Hello World!",
			path: "/usr/local/bin",
			url: "https://example.com?q=test&lang=en",
			special: "key=value&foo=bar",
		})
		expect(special).toContain("message=Hello World!")
		expect(special).toContain("path=/usr/local/bin")
		expect(special).toContain("url=https://example.com?q=test&lang=en")
		expect(special).toContain("special=key=value&foo=bar")
	})

	test("handles nested objects at various depths", () => {
		// Simple nested object
		const simple = convertConfigToDotArgs({
			model: {
				name: "gpt-4",
				temperature: 0.7,
			},
		})
		expect(simple).toContain("model.name=gpt-4")
		expect(simple).toContain("model.temperature=0.7")

		// Deeply nested objects
		const deep = convertConfigToDotArgs({
			database: {
				connection: {
					host: "localhost",
					port: 5432,
					ssl: {
						enabled: true,
						cert: "/path/to/cert",
					},
				},
			},
		})
		expect(deep).toContain("database.connection.host=localhost")
		expect(deep).toContain("database.connection.port=5432")
		expect(deep).toContain("database.connection.ssl.enabled=true")
		expect(deep).toContain("database.connection.ssl.cert=/path/to/cert")
		expect(deep.length).toBe(4)
	})

	test("handles arrays of various types", () => {
		// Simple array of strings
		const stringArray = convertConfigToDotArgs({
			tags: ["production", "api", "v2"],
		})
		expect(stringArray).toContain("tags.0=production")
		expect(stringArray).toContain("tags.1=api")
		expect(stringArray).toContain("tags.2=v2")

		// Array of numbers
		const numberArray = convertConfigToDotArgs({
			ports: [8080, 8081, 8082],
		})
		expect(numberArray).toContain("ports.0=8080")
		expect(numberArray).toContain("ports.1=8081")
		expect(numberArray).toContain("ports.2=8082")

		// Array of objects
		const objectArray = convertConfigToDotArgs({
			servers: [
				{ host: "server1.com", port: 443 },
				{ host: "server2.com", port: 8080 },
			],
		})
		expect(objectArray).toContain("servers.0.host=server1.com")
		expect(objectArray).toContain("servers.0.port=443")
		expect(objectArray).toContain("servers.1.host=server2.com")
		expect(objectArray).toContain("servers.1.port=8080")

		// Nested arrays (2D matrix)
		const nestedArray = convertConfigToDotArgs({
			matrix: [
				[1, 2, 3],
				[4, 5, 6],
			],
		})
		expect(nestedArray).toContain("matrix.0.0=1")
		expect(nestedArray).toContain("matrix.0.1=2")
		expect(nestedArray).toContain("matrix.1.2=6")
		expect(nestedArray.length).toBe(6)

		// Empty array
		expect(convertConfigToDotArgs({ items: [] })).toEqual([])
	})

	test("handles complex real-world configurations", () => {
		// MCP server config example
		const mcpConfig = convertConfigToDotArgs({
			model: {
				name: "gpt-4",
				temperature: 0.7,
				maxTokens: 2000,
			},
			apiKey: "sk-test-123",
			debug: true,
			timeout: 30000,
		})
		expect(mcpConfig).toContain("model.name=gpt-4")
		expect(mcpConfig).toContain("model.temperature=0.7")
		expect(mcpConfig).toContain("model.maxTokens=2000")
		expect(mcpConfig).toContain("apiKey=sk-test-123")
		expect(mcpConfig).toContain("debug=true")
		expect(mcpConfig).toContain("timeout=30000")
		expect(mcpConfig.length).toBe(6)

		// Mixed nested structure with all types
		const complex = convertConfigToDotArgs({
			app: {
				name: "MyApp",
				version: 2,
				features: {
					auth: true,
					analytics: false,
				},
				endpoints: [
					{ path: "/api/v1", secure: true },
					{ path: "/api/v2", secure: true },
				],
			},
			stringVal: "test",
			numberVal: 42,
			boolVal: true,
			nullVal: null,
			arrayOfPrimitives: [1, 2, 3],
		})
		expect(complex).toContain("app.name=MyApp")
		expect(complex).toContain("app.version=2")
		expect(complex).toContain("app.features.auth=true")
		expect(complex).toContain("app.endpoints.0.path=/api/v1")
		expect(complex).toContain("app.endpoints.1.secure=true")
		expect(complex).toContain("stringVal=test")
		expect(complex).toContain("numberVal=42")
		expect(complex).toContain("boolVal=true")
		expect(complex).toContain("nullVal=null")
		expect(complex).toContain("arrayOfPrimitives.0=1")
		expect(complex).toContain("arrayOfPrimitives.2=3")
	})
})
