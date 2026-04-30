import { promises as fs } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { verbose } from "../lib/logger"

const CACHE_DIR = join(homedir(), ".smithery")

function sanitizeFileName(name: string): string {
	return name.replace(/[^a-zA-Z0-9_.-]/g, "_")
}

function cacheFilePath(server: string, toolName: string): string {
	const safeName = `${sanitizeFileName(server)}__${sanitizeFileName(toolName)}.ts`
	return join(CACHE_DIR, safeName)
}

/**
 * Convert a JSON Schema property to a Zod type expression string.
 */
function jsonSchemaTypeToZod(schema: Record<string, unknown>): string {
	if (schema.enum) {
		const values = schema.enum as unknown[]
		const literals = values.map((v) =>
			typeof v === "string" ? `z.literal(${JSON.stringify(v)})` : `z.literal(${v})`,
		)
		if (literals.length === 1) return literals[0]
		return `z.union([${literals.join(", ")}])`
	}

	if (schema.anyOf || schema.oneOf) {
		const variants = (schema.anyOf ?? schema.oneOf) as Record<string, unknown>[]
		const types = variants.map((v) => jsonSchemaTypeToZod(v))
		if (types.length === 1) return types[0]
		return `z.union([${types.join(", ")}])`
	}

	const type = schema.type as string | string[] | undefined

	if (Array.isArray(type)) {
		const nonNull = type.filter((t) => t !== "null")
		if (nonNull.length === 1) {
			const inner = jsonSchemaTypeToZod({ ...schema, type: nonNull[0] })
			return type.includes("null") ? `${inner}.nullable()` : inner
		}
		const types = nonNull.map((t) => jsonSchemaTypeToZod({ ...schema, type: t }))
		const union = types.length === 1 ? types[0] : `z.union([${types.join(", ")}])`
		return type.includes("null") ? `${union}.nullable()` : union
	}

	switch (type) {
		case "string":
			return "z.string()"
		case "number":
		case "integer":
			return "z.number()"
		case "boolean":
			return "z.boolean()"
		case "null":
			return "z.null()"
		case "array": {
			const items = schema.items as Record<string, unknown> | undefined
			const itemType = items ? jsonSchemaTypeToZod(items) : "z.unknown()"
			return `z.array(${itemType})`
		}
		case "object": {
			return objectSchemaToZod(schema)
		}
		default:
			return "z.unknown()"
	}
}

function objectSchemaToZod(
	schema: Record<string, unknown>,
	requiredFields?: Set<string>,
): string {
	const properties = schema.properties as
		| Record<string, Record<string, unknown>>
		| undefined

	if (!properties || Object.keys(properties).length === 0) {
		return "z.record(z.string(), z.unknown())"
	}

	const required =
		requiredFields ?? new Set((schema.required as string[] | undefined) ?? [])

	const fields = Object.entries(properties).map(([key, propSchema]) => {
		const zodType = jsonSchemaTypeToZod(propSchema)
		const desc = propSchema.description as string | undefined
		const descChain = desc ? `.describe(${JSON.stringify(desc)})` : ""
		const optionalChain = required.has(key) ? "" : ".optional()"
		return `\t${safeKey(key)}: ${zodType}${descChain}${optionalChain},`
	})

	return `z.object({\n${fields.join("\n")}\n})`
}

function safeKey(key: string): string {
	return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
}

/**
 * Infer a Zod schema expression from a runtime value.
 */
function inferZodFromValue(value: unknown): string {
	if (value === null) return "z.null()"
	if (value === undefined) return "z.undefined()"

	switch (typeof value) {
		case "string":
			return "z.string()"
		case "number":
			return "z.number()"
		case "boolean":
			return "z.boolean()"
		case "object": {
			if (Array.isArray(value)) {
				if (value.length === 0) return "z.array(z.unknown())"
				// Infer from first element
				return `z.array(${inferZodFromValue(value[0])})`
			}
			const obj = value as Record<string, unknown>
			const entries = Object.entries(obj)
			if (entries.length === 0) return "z.record(z.string(), z.unknown())"
			const fields = entries.map(([key, val]) => {
				return `\t${safeKey(key)}: ${inferZodFromValue(val)},`
			})
			return `z.object({\n${fields.join("\n")}\n})`
		}
		default:
			return "z.unknown()"
	}
}

/**
 * Extract a usable value from an MCP tool result for output schema inference.
 */
function extractResultValue(result: Record<string, unknown>): unknown | null {
	// Prefer structuredContent
	if (result.structuredContent != null) {
		return result.structuredContent
	}

	// Try to parse JSON from text content blocks
	const content = result.content
	if (!Array.isArray(content)) return null

	for (const block of content) {
		if (
			typeof block === "object" &&
			block !== null &&
			(block as Record<string, unknown>).type === "text"
		) {
			const text = (block as Record<string, unknown>).text as string
			try {
				return JSON.parse(text)
			} catch {
				// Not JSON, return as string
				return text
			}
		}
	}

	return null
}

function generateSchemaFile(
	server: string,
	toolName: string,
	inputSchema: Record<string, unknown>,
	result: Record<string, unknown>,
): string {
	const inputExpr = objectSchemaToZod(
		{ type: "object", ...inputSchema },
		new Set((inputSchema.required as string[] | undefined) ?? []),
	)

	const resultValue = extractResultValue(result)
	const outputExpr = resultValue != null
		? inferZodFromValue(resultValue)
		: "z.unknown()"

	return `import { z } from "zod"

// Auto-generated schemas for ${server} / ${toolName}

export const inputSchema = ${inputExpr}

export type Input = z.infer<typeof inputSchema>

export const outputSchema = ${outputExpr}

export type Output = z.infer<typeof outputSchema>
`
}

/**
 * Cache a tool's input schema and inferred output schema as a zod .ts file in ~/.smithery/.
 * Called after a successful tool call.
 */
export async function cacheToolSchema(
	server: string,
	toolName: string,
	inputSchema: Record<string, unknown>,
	result: Record<string, unknown>,
): Promise<void> {
	try {
		await fs.mkdir(CACHE_DIR, { recursive: true })
		const filePath = cacheFilePath(server, toolName)
		const content = generateSchemaFile(server, toolName, inputSchema, result)
		await fs.writeFile(filePath, content, "utf-8")
		verbose(`[Cache] Wrote tool schema to ${filePath}`)
	} catch (error) {
		verbose(
			`[Cache] Failed to cache tool schema: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}
