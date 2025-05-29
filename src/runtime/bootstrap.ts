// Universal bootstrap for both dev and production builds
import {
	createStatefulServer,
	type CreateServerFn as CreateStatefulServerFn,
} from "@smithery/sdk/server/stateful.js"
import {
	createStatelessServer,
	type CreateServerFn as CreateStatelessServerFn,
} from "@smithery/sdk/server/stateless.js"
import cors from "cors"
import express from "express"
import type { z } from "zod"

// Type declaration for the user module
interface SmitheryModule {
	// Named exports
	createStatefulServer?: CreateStatefulServerFn
	createStatelessServer?: CreateStatelessServerFn
	configSchema?: z.ZodSchema
	// Default export (backward compatibility)
	default?: CreateStatelessServerFn
}

// These will be replaced by esbuild at build time
declare const __SMITHERY_ENTRY__: string

async function startMcpServer() {
	try {
		const port = process.env.PORT || "8181"

		console.log(`[smithery] Starting MCP server on port ${port}`)

		// Load user module - different approach for dev vs prod
		const entry: SmitheryModule = await import(__SMITHERY_ENTRY__)

		let server: { app: express.Application }

		const app = express()

		// Inject cors for development
		if (process.env.NODE_ENV !== "production") {
			console.log(`[smithery] Injecting cors middleware`)
			app.use(
				cors({
					exposedHeaders: ["mcp-session-id"],
				}),
			)
		}

		if (
			entry.createStatefulServer &&
			typeof entry.createStatefulServer === "function"
		) {
			// Stateful server
			console.log(`[smithery] Setting up stateful server.`)

			server = createStatefulServer(entry.createStatefulServer, {
				schema: entry.configSchema,
				app,
			})
		} else if (
			entry.createStatelessServer &&
			typeof entry.createStatelessServer === "function"
		) {
			// Stateless server
			console.log(`[smithery] Setting up stateless server`)

			server = createStatelessServer(entry.createStatelessServer, {
				schema: entry.configSchema,
				app,
			})
		} else {
			throw new Error(
				"No valid server export found. Please export either:\n" +
					"- export function createStatefulServer({ sessionId, config }) { ... }\n" +
					"- export function createStatelessServer({ config }) { ... }\n" +
					"- export default function({ config }) { ... }",
			)
		}

		// Start the server
		server.app.listen(Number.parseInt(port))
		console.log(`[smithery] MCP server started successfully on port ${port}`)
	} catch (error) {
		console.error(`[smithery] Failed to start MCP server:`, error)
		process.exit(1)
	}
}

// Start the server
startMcpServer()
