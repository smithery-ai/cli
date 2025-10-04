// These will be replaced by esbuild at build time.
// @ts-expect-error
import * as _entry from "virtual:user-module"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { Logger } from "@smithery/sdk/server/logger.js"
import type { CreateServerFn as CreateStatefulServerFn } from "@smithery/sdk/server/stateful.js"
import chalk from "chalk"
import _ from "lodash"
import { uuidv7 } from "uuidv7"
import type { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

// Type declaration for the user module
interface SmitheryModule {
	configSchema?: z.ZodSchema
	// Default export (treated as stateful server)
	default?: CreateStatefulServerFn
}

const entry: SmitheryModule = _entry

// Simple stderr logger for stdio mode
const formatLog = (
	level: string,
	color: (str: string) => string,
	msgOrObj: unknown,
	msg?: string,
) => {
	const time = new Date().toISOString().split("T")[1].split(".")[0]
	const timestamp = chalk.dim(time)
	const levelStr = color(level)

	if (typeof msgOrObj === "string") {
		return `${timestamp} ${levelStr} ${msgOrObj}`
	}
	const message = msg || ""
	const data = JSON.stringify(msgOrObj, null, 2)
	return `${timestamp} ${levelStr} ${message}\n${chalk.dim(data)}`
}

const logger: Logger = {
	info: (msgOrObj: unknown, msg?: string) =>
		console.error(formatLog("INFO", chalk.blue, msgOrObj, msg)),
	error: (msgOrObj: unknown, msg?: string) =>
		console.error(formatLog("ERROR", chalk.red, msgOrObj, msg)),
	warn: (msgOrObj: unknown, msg?: string) =>
		console.error(formatLog("WARN", chalk.yellow, msgOrObj, msg)),
	debug: (msgOrObj: unknown, msg?: string) =>
		console.error(formatLog("DEBUG", chalk.cyan, msgOrObj, msg)),
} as Logger

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
			logger.error("Configuration validation failed:")
			logger.error(errors.join("\n"))
			logger.error("Expected schema:")
			logger.error(JSON.stringify(jsonSchema, null, 2))
			logger.error("Example usage:")
			logger.error(
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
		logger.info("Starting MCP server with stdio transport")

		// Parse CLI arguments (skip first two: node executable and script path)
		const args = process.argv.slice(2)
		const { config, errors } = parseCliConfig(args, entry.configSchema)

		if (errors) {
			process.exit(1)
		}

		let mcpServer: Server
		if (entry.default && typeof entry.default === "function") {
			logger.info("Creating server")
			mcpServer = entry.default({ sessionId: uuidv7(), config, logger })
		} else {
			throw new Error(
				"No valid server export found. Please export:\n" +
					"- export default function({ sessionId, config, logger }) { ... }",
			)
		}

		// Connect the MCP server to stdio transport
		const transport = new StdioServerTransport()
		await mcpServer.connect(transport)

		logger.info("MCP server connected to stdio transport")

		// If config was provided, show what was parsed
		if (Object.keys(config).length > 0) {
			logger.info({ config }, "Configuration loaded")
		}
	} catch (error) {
		logger.error({ error }, "Failed to start MCP server")
		process.exit(1)
	}
}

startMcpServer().catch((error) => {
	logger.error({ error }, "Unhandled error")
	process.exit(1)
})
