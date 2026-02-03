/**
 * Types for entries in the Smithery registry
 */
import { z } from "zod"

// Define the type explicitly for proper TypeScript inference
export interface JSONSchema {
	type?: string
	properties?: Record<string, JSONSchema>
	items?: JSONSchema
	required?: string[]
	description?: string
	default?: unknown
}

const JSONSchemaSchema: z.ZodType<JSONSchema> = z.lazy(() =>
	z.object({
		type: z.string().optional(),
		properties: z.record(z.string(), JSONSchemaSchema).optional(),
		items: JSONSchemaSchema.optional(),
		required: z.array(z.string()).optional(),
		description: z.string().optional(),
		default: z.unknown().optional(),
	}),
)

// list of configured MCP servers stored locally
export interface MCPConfig {
	mcpServers: Record<string, ConfiguredServer>
}

// stdio connection
const StdioConnectionSchema = z.object({
	command: z.string().describe("The executable to run to start the server."),
	args: z
		.array(z.string())
		.optional()
		.describe("Command line arguments to pass to the executable."),
	env: z
		.record(z.string(), z.string())
		.optional()
		.describe("The environment to use when spawning the process."),
})

// streamable http connection (for client config files)
const StreamableHTTPConnectionSchema = z.object({
	type: z.literal("http").describe("Connection type for HTTP servers."),
	url: z.string().describe("The direct URL of the HTTP MCP server."),
	headers: z
		.record(z.string(), z.string())
		.optional()
		.describe("Optional HTTP headers to include."),
})

export type StdioConnection = z.infer<typeof StdioConnectionSchema>
export type StreamableHTTPConnection = z.infer<
	typeof StreamableHTTPConnectionSchema
>

export type ConfiguredServer = StdioConnection | StreamableHTTPConnection

// Server Configuration key value pairs
export interface ServerConfig {
	[key: string]: unknown
}
