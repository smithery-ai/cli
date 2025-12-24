import { describe, expect, it } from "vitest"
import { convertMCPBUserConfigToJSONSchema } from "../../mcpb.js"

describe("converts flat MCPB user config format to nested JSONSchema format", () => {
	it("handles empty input", () => {
		const result = convertMCPBUserConfigToJSONSchema({})
		expect(result).toEqual({
			type: "object",
			properties: {},
			required: [],
		})
	})

	it("converts flat keys to top-level properties", () => {
		const input = { apiKey: { type: "string" as const } }
		const result = convertMCPBUserConfigToJSONSchema(input)
		expect(result).toEqual({
			type: "object",
			properties: {
				apiKey: {
					type: "string",
				},
			},
			required: [],
		})
	})

	it("converts dot-notation keys to nested structure", () => {
		const input = { "auth.apiKey": { type: "string" as const } }
		const result = convertMCPBUserConfigToJSONSchema(input)
		expect(result).toEqual({
			type: "object",
			properties: {
				auth: {
					type: "object",
					properties: {
						apiKey: {
							type: "string",
						},
					},
				},
			},
			required: [],
		})
	})

	it("converts deeply nested dot-notation keys", () => {
		const input = { "a.b.c": { type: "string" as const } }
		const result = convertMCPBUserConfigToJSONSchema(input)
		expect(result).toEqual({
			type: "object",
			properties: {
				a: {
					type: "object",
					properties: {
						b: {
							type: "object",
							properties: {
								c: {
									type: "string",
								},
							},
						},
					},
				},
			},
			required: [],
		})
	})

	it("handles required fields at top level", () => {
		const input = { apiKey: { type: "string" as const, required: true } }
		const result = convertMCPBUserConfigToJSONSchema(input)
		expect(result).toEqual({
			type: "object",
			properties: {
				apiKey: {
					type: "string",
				},
			},
			required: ["apiKey"],
		})
	})

	it("handles required fields in nested objects", () => {
		const input = { "auth.apiKey": { type: "string" as const, required: true } }
		const result = convertMCPBUserConfigToJSONSchema(input)
		expect(result).toEqual({
			type: "object",
			properties: {
				auth: {
					type: "object",
					properties: {
						apiKey: {
							type: "string",
						},
					},
					required: ["apiKey"],
				},
			},
			required: ["auth"],
		})
	})

	it("converts array types with items schema", () => {
		const input = {
			tags: {
				type: "string" as const,
				multiple: true,
			},
		}
		const result = convertMCPBUserConfigToJSONSchema(input)
		expect(result).toEqual({
			type: "object",
			properties: {
				tags: {
					type: "array",
					items: {
						type: "string",
					},
				},
			},
			required: [],
		})
	})

	it("preserves description and default values", () => {
		const input = {
			apiKey: {
				type: "string" as const,
				description: "API key",
				default: "default-key",
			},
		}
		const result = convertMCPBUserConfigToJSONSchema(input)
		expect(result).toEqual({
			type: "object",
			properties: {
				apiKey: {
					type: "string",
					description: "API key",
					default: "default-key",
				},
			},
			required: [],
		})
	})

	it("handles multiple required nested fields in same object", () => {
		const input = {
			"auth.apiKey": { type: "string" as const, required: true },
			"auth.secret": { type: "string" as const, required: true },
		}
		const result = convertMCPBUserConfigToJSONSchema(input)
		expect(result).toEqual({
			type: "object",
			properties: {
				auth: {
					type: "object",
					properties: {
						apiKey: {
							type: "string",
						},
						secret: {
							type: "string",
						},
					},
					required: ["apiKey", "secret"],
				},
			},
			required: ["auth"],
		})
	})

	it("handles mixed flat and nested structures", () => {
		const input = {
			apiKey: { type: "string" as const },
			"auth.secret": { type: "string" as const },
		}
		const result = convertMCPBUserConfigToJSONSchema(input)
		expect(result).toEqual({
			type: "object",
			properties: {
				apiKey: {
					type: "string",
				},
				auth: {
					type: "object",
					properties: {
						secret: {
							type: "string",
						},
					},
				},
			},
			required: [],
		})
	})

	it("preserves different types (number, boolean)", () => {
		const input = {
			port: { type: "number" as const },
			enabled: { type: "boolean" as const },
		}
		const result = convertMCPBUserConfigToJSONSchema(input)
		expect(result).toEqual({
			type: "object",
			properties: {
				port: {
					type: "number",
				},
				enabled: {
					type: "boolean",
				},
			},
			required: [],
		})
	})

	it("handles nested array types", () => {
		const input = {
			"config.tags": {
				type: "string" as const,
				multiple: true,
			},
		}
		const result = convertMCPBUserConfigToJSONSchema(input)
		expect(result).toEqual({
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						tags: {
							type: "array",
							items: {
								type: "string",
							},
						},
					},
				},
			},
			required: [],
		})
	})
})
