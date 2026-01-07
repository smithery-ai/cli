import { execSync } from "node:child_process"
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import type { Prompt, Resource, Tool } from "@modelcontextprotocol/sdk/types.js"
import type { ServerModule, Session } from "@smithery/sdk"
import type { ServerCard } from "@smithery/sdk/bundle"
import chalk from "chalk"
import { z } from "zod"
import { buildServer } from "./build.js"
import { createDeployPayload } from "./bundle-utils.js"

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

function generateMockConfig(zodSchema: z.ZodType): unknown {
	const jsonSchema = z.toJSONSchema(zodSchema) as JsonSchema
	return generateMockFromJsonSchema(jsonSchema)
}

function getGitInfo(): { commit?: string; branch?: string } {
	try {
		const commit = execSync("git rev-parse HEAD", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim()
		const branch = execSync("git rev-parse --abbrev-ref HEAD", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim()
		return { commit, branch }
	} catch {
		return {}
	}
}

export interface BundleOptions {
	entryFile?: string
	outDir?: string
	production?: boolean
}

interface ScanResult {
	serverCard?: ServerCard
	configSchema?: Record<string, unknown>
	stateful?: boolean
}

async function scanModule(modulePath: string): Promise<ScanResult> {
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

	// Use InMemoryTransport to communicate with the server
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
			? (z.toJSONSchema(serverModule.configSchema as z.ZodType) as Record<
					string,
					unknown
				>)
			: undefined,
		stateful,
	}
}

/**
 * Build and assemble a Smithery Bundle for deployment
 */
export async function buildDeployBundle(options: BundleOptions = {}) {
	const outDir = options.outDir || ".smithery/bundle"
	const entryFile = options.entryFile

	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true })
	}

	console.log(chalk.cyan("\nBuilding for Smithery deploy..."))
	const userModuleFile = join(outDir, "user-module.js")
	await buildServer({
		entryFile,
		outFile: userModuleFile,
		transport: "shttp",
		production: options.production ?? true,
		minify: true,
		bundleMode: "user-module",
		sourceMaps: true,
	})

	// Build a Node.js version for scanning
	console.log(chalk.cyan("\nScanning server capabilities..."))
	const scanModuleFile = join(outDir, `scan-${Date.now()}.cjs`)
	await buildServer({
		entryFile,
		outFile: scanModuleFile,
		transport: "stdio",
		bundleMode: "user-module",
		production: false,
		minify: false,
		sourceMaps: false,
	})

	let scanResult: ScanResult = {}
	try {
		scanResult = await scanModule(scanModuleFile)
	} catch (e) {
		console.error(chalk.red("\n✗ Failed to scan server capabilities"))
		console.error(chalk.dim(`  ${e instanceof Error ? e.message : e}`))
		console.error(
			chalk.yellow(
				"\nYour server requires configuration to run. Export a createSandboxServer function:",
			),
		)
		console.error(
			chalk.dim(`
  // In your server entry file:
  import { createServer } from "./server"

  export function createSandboxServer() {
    // Return a server instance with mock/default config for scanning
    return createServer({
      apiKey: "test-key",
      // ... other required config with safe defaults
    })
  }
`),
		)
		console.error(
			chalk.dim(
				"This allows Smithery to scan your server's tools/resources without real credentials.",
			),
		)
		console.error(
			chalk.dim("Learn more: https://smithery.ai/docs/deploy#sandbox-server\n"),
		)
		throw new Error("Server scan failed - cannot generate server card")
	} finally {
		if (existsSync(scanModuleFile)) {
			unlinkSync(scanModuleFile)
		}
	}

	const gitInfo = getGitInfo()
	const payload = createDeployPayload({
		stateful: scanResult.stateful,
		serverCard: scanResult.serverCard,
		configSchema: scanResult.configSchema,
		commit: gitInfo.commit,
		branch: gitInfo.branch,
	})

	writeFileSync(join(outDir, "manifest.json"), JSON.stringify(payload, null, 2))

	console.log(
		chalk.green("\n✓ Smithery Bundle created successfully at ") +
			chalk.bold(outDir),
	)

	return { outDir, payload }
}
