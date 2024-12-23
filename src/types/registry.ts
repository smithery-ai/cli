/**
 * Types for entries in the Smithery registry
 */
import { z } from "zod"

// Base registry package (what we receive)
export interface RegistryServer {
	id: string
	name: string
	connections: Array<ConnectionDetails>
}

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

export const ConnectionDetailsSchema = z.object({
	type: z.enum(["stdio"]),
	configSchema: JSONSchemaSchema.optional(),
	exampleConfig: z.record(z.any()).optional(),
})

export type ConnectionDetails = z.infer<typeof ConnectionDetailsSchema>

// Resolved server (after we check against our registry on installation status)
export interface ResolvedServer {
	id: string
	name: string
	isInstalled: boolean
	client?: string
	connections: Array<ConnectionDetails>
}

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

export type StdioConnection = z.infer<typeof StdioConnectionSchema>

// used in POST request and also in local fetch from config file
export type ConfiguredServer = StdioConnection
