import { describe, expect, test } from "vitest"
import { z } from "zod"

interface JsonSchema {
	type?: string
	properties?: Record<string, JsonSchema>
	items?: JsonSchema
	default?: unknown
	enum?: unknown[]
}

function generateMockFromJsonSchema(schema: JsonSchema): unknown {
	if (schema.default !== undefined) return schema.default
	if (schema.enum?.length) return schema.enum[0]

	switch (schema.type) {
		case "string":
			return "mock-value"
		case "number":
		case "integer":
			return 0
		case "boolean":
			return false
		case "array":
			return schema.items ? [generateMockFromJsonSchema(schema.items)] : []
		case "object": {
			if (!schema.properties) return {}
			const obj: Record<string, unknown> = {}
			for (const [key, prop] of Object.entries(schema.properties)) {
				obj[key] = generateMockFromJsonSchema(prop)
			}
			return obj
		}
		default:
			return null
	}
}

describe("generateMockFromJsonSchema", () => {
	test("generates mock config from zod schema", () => {
		const configSchema = z.object({
			apiKey: z.string(),
			maxRetries: z.number(),
			debug: z.boolean(),
			tags: z.array(z.string()),
		})

		const jsonSchema = z.toJSONSchema(configSchema) as JsonSchema
		const mock = generateMockFromJsonSchema(jsonSchema)

		expect(mock).toEqual({
			apiKey: "mock-value",
			maxRetries: 0,
			debug: false,
			tags: ["mock-value"],
		})
	})

	test("uses default values when present", () => {
		const configSchema = z.object({
			name: z.string().default("test-name"),
			count: z.number().default(42),
		})

		const jsonSchema = z.toJSONSchema(configSchema) as JsonSchema
		const mock = generateMockFromJsonSchema(jsonSchema)

		expect(mock).toEqual({
			name: "test-name",
			count: 42,
		})
	})

	test("uses first enum value", () => {
		const configSchema = z.object({
			level: z.enum(["debug", "info", "error"]),
		})

		const jsonSchema = z.toJSONSchema(configSchema) as JsonSchema
		const mock = generateMockFromJsonSchema(jsonSchema)

		expect(mock).toEqual({ level: "debug" })
	})
})
