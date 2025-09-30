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

// bundle connection (stdio with bundleUrl where the bundle/binary is stored)
export const BundleConnectionSchema = z.object({
	bundleUrl: z.string().describe("The URL where the downloadable bundle is stored."),
	runtime: z
		.enum(["node"])
		.optional()
		.describe("Runtime required to execute the bundle (default: node)."),
})

// streamable http deployment connection (for CLI internal use)
export const StreamableHTTPDeploymentConnectionSchema = z.object({
	deploymentUrl: z.string().describe("The URL of the Streamable HTTP server."),
})

// streamable http connection (for client config files)
export const StreamableHTTPConnectionSchema = z.object({
	type: z.literal("http").describe("Connection type for HTTP servers."),
	url: z.string().describe("The direct URL of the HTTP MCP server."),
	headers: z
		.record(z.string(), z.string())
		.optional()
		.describe("Optional HTTP headers to include."),
})

export type StdioConnection = z.infer<typeof StdioConnectionSchema>
export type BundleConnection = z.infer<typeof BundleConnectionSchema>
export type StreamableHTTPDeploymentConnection = z.infer<
	typeof StreamableHTTPDeploymentConnectionSchema
>
export type StreamableHTTPConnection = z.infer<
	typeof StreamableHTTPConnectionSchema
>

export type ConfiguredServer = StdioConnection | StreamableHTTPConnection

// Server Configuration key value pairs
export interface ServerConfig {
	[key: string]: unknown
}

// Connection type schema (for registry API)
export const ConnectionTypeSchema = z.union([
	z.object({
		type: z.literal("stdio"),
		...StdioConnectionSchema.shape,
	}),
	z.object({
		type: z.literal("stdio"),
		...BundleConnectionSchema.shape,
	}),
	z.object({
		type: z.literal("http"),
		...StreamableHTTPDeploymentConnectionSchema.shape,
	}),
])

export type ConnectionType = "stdio" | "http"
