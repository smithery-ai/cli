import { pathToFileURL } from "node:url"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import type { Prompt, Resource, Tool } from "@modelcontextprotocol/sdk/types.js"
import type { ServerCard } from "@smithery/api/resources/servers/deployments"
import type { ServerModule, Session } from "@smithery/sdk"
import { z } from "zod"
import zodToJsonSchema from "zod-to-json-schema"

interface JsonSchema {
	type?: string | string[]
	properties?: Record<string, JsonSchema>
	items?: JsonSchema
	default?: unknown
	enum?: unknown[]
	title?: string
	description?: string
	required?: string[]
	minimum?: number
	maximum?: number
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
			const required = new Set(schema.required || [])
			for (const [key, prop] of Object.entries(schema.properties)) {
				if (required.has(key)) {
					obj[key] = generateMockFromJsonSchema(prop)
				}
			}
			return obj
		}
		default:
			return null
	}
}

function zodSchemaToJsonSchema(zodSchema: unknown): JsonSchema {
	// Try Zod v4 first (CLI's native version)
	try {
		return z.toJSONSchema(zodSchema as z.ZodType) as JsonSchema
	} catch {
		// Fall back to zod-to-json-schema for Zod v3 schemas
		return zodToJsonSchema(
			zodSchema as Parameters<typeof zodToJsonSchema>[0],
		) as JsonSchema
	}
}

function generateMockConfig(zodSchema: unknown): unknown {
	const jsonSchema = zodSchemaToJsonSchema(zodSchema)
	return generateMockFromJsonSchema(jsonSchema)
}

export interface ScanResult {
	serverCard?: ServerCard
	configSchema?: Record<string, unknown>
	stateful?: boolean
}

export async function scanModule(modulePath: string): Promise<ScanResult> {
	const module = (await import(pathToFileURL(modulePath).href)) as {
		default: ServerModule
		stateful?: boolean
	}
	const serverModule = module.default
	const stateful = module.stateful ?? false

	const session: Session = {
		id: "scan-session",
		get: async () => undefined,
		set: async () => {},
		delete: async () => {},
	}

	let server: Server
	if (serverModule.createSandboxServer) {
		server = await serverModule.createSandboxServer({ session })
	} else {
		const config = serverModule.configSchema
			? generateMockConfig(serverModule.configSchema as z.ZodType)
			: undefined
		server = await serverModule.default({
			config,
			session,
			env: process.env,
		})
	}

	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair()
	const client = new Client({ name: "scan-client", version: "1.0.0" })

	await server.connect(serverTransport)
	await client.connect(clientTransport)

	const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
		client.listTools().catch(() => ({ tools: [] })),
		client.listResources().catch(() => ({ resources: [] })),
		client.listPrompts().catch(() => ({ prompts: [] })),
	])

	await client.close()

	const serverCard: ServerCard = {
		serverInfo: client.getServerVersion() || {
			name: "unknown",
			version: "0.0.0",
		},
		tools: toolsResult.tools as Tool[],
		resources: resourcesResult.resources as Resource[],
		prompts: promptsResult.prompts as Prompt[],
	}

	return {
		serverCard,
		configSchema: serverModule.configSchema
			? (zodSchemaToJsonSchema(serverModule.configSchema) as Record<
					string,
					unknown
				>)
			: undefined,
		stateful,
	}
}
