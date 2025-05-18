/**
 * Types for entries in the Smithery registry
 */
import { z } from "zod"

export const JSONSchemaSchema: z.ZodType = z.lazy(() =>
	z.object({
		type: z.string().optional(),
		properties: z.record(JSONSchemaSchema).optional(),
		items: JSONSchemaSchema.optional(),
		required: z.array(z.string()).optional(),
		description: z.string().optional(),
		default: z.unknown().optional(),
	}),
)

export type JSONSchema = z.infer<typeof JSONSchemaSchema>

// list of configured MCP servers stored locally
export interface MCPConfig {
	mcpServers: Record<string, ConfiguredServer>
}

// stdio connection
export const StdioConnectionSchema = z.object({
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

// streamable http connection
export const StreamableHTTPConnectionSchema = z.object({
	deploymentUrl: z.string().describe("The URL of the Streamable HTTP server."),
})

export type StdioConnection = z.infer<typeof StdioConnectionSchema>
export type StreamableHTTPConnection = z.infer<
	typeof StreamableHTTPConnectionSchema
>

// Update ConfiguredServer to handle all types
export type ConfiguredServer = StdioConnection | StreamableHTTPConnection

// Server Configuration key value pairs
export interface ServerConfig {
	[key: string]: unknown
}

// Connection type schema
export const ConnectionTypeSchema = z.union([
	z.object({
		type: z.literal("stdio"),
		...StdioConnectionSchema.shape,
	}),
	z.object({
		type: z.literal("http"),
		...StreamableHTTPConnectionSchema.shape,
	}),
])

export type ConnectionType = "stdio" | "http"
