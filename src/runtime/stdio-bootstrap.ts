import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { CreateServerFn as CreateStatefulServerFn } from "@smithery/sdk/server/stateful.js"
import type { CreateServerFn as CreateStatelessServerFn } from "@smithery/sdk/server/stateless.js"
import _ from "lodash"
import type { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

// These will be replaced by esbuild at build time.
// @ts-ignore
import * as _entry from "virtual:user-module"

// Type declaration for the user module
interface SmitheryModule {
	// Named exports
	createStatefulServer?: CreateStatefulServerFn
	createStatelessServer?: CreateStatelessServerFn
	configSchema?: z.ZodSchema
}

const entry: SmitheryModule = _entry

/**
 * Parses CLI arguments in dot notation format (e.g., field.subfield=value)
 */
function parseCliConfig<T = Record<string, unknown>>(
	args: string[],
	schema?: z.ZodSchema<T>,
): { config: T; errors?: string[] } {
	const config: Record<string, unknown> = {}

	// Parse command line arguments
	for (const arg of args) {
		// Skip if not in key=value format
		const match = arg.match(/^([^=]+)=(.*)$/)
		if (!match) continue

		const [, key, rawValue] = match
		const pathParts = key.split(".")

		// Try to parse value as JSON (for booleans, numbers, objects)
		let parsedValue: unknown = rawValue
		try {
			parsedValue = JSON.parse(rawValue)
		} catch {
			// If parsing fails, use the raw string value
		}

		// Use lodash's set method to handle nested paths
		_.set(config, pathParts, parsedValue)
	}

	// Validate config against schema if provided
	if (schema) {
		const result = schema.safeParse(config)
		if (!result.success) {
			const jsonSchema = zodToJsonSchema(schema)
			const errors = result.error.issues.map((issue) => {
				const path = issue.path.join(".")
				const message = issue.message

				// Get the value that was received
				let received: unknown = config
				for (const key of issue.path) {
					if (received && typeof received === "object" && key in received) {
						received = (received as Record<string, unknown>)[key]
					} else {
						received = undefined
						break
					}
				}

				return `  ${path}: ${message} (received: ${JSON.stringify(received)})`
			})

			// Print schema information
			console.error("\n[smithery] Configuration validation failed:")
			console.error(errors.join("\n"))
			console.error("\nExpected schema:")
			console.error(JSON.stringify(jsonSchema, null, 2))
			console.error("\nExample usage:")
			console.error(
				"  node server.js server.host=localhost server.port=8080 debug=true",
			)

			return { config: config as T, errors }
		}
		return { config: result.data, errors: undefined }
	}

	return { config: config as T, errors: undefined }
}

async function startMcpServer() {
	try {
		console.error(`[smithery] Starting MCP server with stdio transport`)

		// Parse CLI arguments (skip first two: node executable and script path)
		const args = process.argv.slice(2)
		const { config, errors } = parseCliConfig(args, entry.configSchema)

		if (errors) {
			process.exit(1)
		}

		let mcpServer: any

		if (
			entry.createStatefulServer &&
			typeof entry.createStatefulServer === "function"
		) {
			// Stateful server - generate a session ID for stdio
			const sessionId = `stdio-${Date.now()}-${Math.random().toString(36).substring(2)}`
			console.error(
				`[smithery] Creating stateful server with session: ${sessionId}`,
			)

			mcpServer = entry.createStatefulServer({ sessionId, config })
		} else if (
			entry.createStatelessServer &&
			typeof entry.createStatelessServer === "function"
		) {
			// Stateless server
			console.error(`[smithery] Creating stateless server`)

			mcpServer = entry.createStatelessServer({ config })
		} else {
			throw new Error(
				"No valid server export found. Please export either:\n" +
					"- export function createStatefulServer({ sessionId, config }) { ... }\n" +
					"- export function createStatelessServer({ config }) { ... }\n",
			)
		}

		// Connect the MCP server to stdio transport
		const transport = new StdioServerTransport()
		await mcpServer.connect(transport)

		console.error(`[smithery] MCP server connected to stdio transport`)

		// If config was provided, show what was parsed
		if (Object.keys(config).length > 0) {
			console.error(`[smithery] Configuration loaded:`, config)
		}
	} catch (error) {
		console.error(`[smithery] Failed to start MCP server:`, error)
		process.exit(1)
	}
}

startMcpServer().catch((error) => {
	console.error(`[smithery] Unhandled error:`, error)
	process.exit(1)
})
