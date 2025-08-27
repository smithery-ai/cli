import {
	createStatefulServer,
	type CreateServerFn as CreateStatefulServerFn,
} from "@smithery/sdk/server/stateful.js"
import {
	createStatelessServer,
	type CreateStatelessServerFn,
} from "@smithery/sdk/server/stateless.js"
import chalk from "chalk"
import cors from "cors"
import express from "express"
import type { z } from "zod"

// These will be replaced by esbuild at build time.
// @ts-ignore
import * as _entry from "virtual:user-module"

// Type declaration for the user module
interface SmitheryModule {
	configSchema?: z.ZodSchema
	stateless?: boolean
	// Default export (can be stateful or stateless server)
	default?: CreateStatefulServerFn | CreateStatelessServerFn
}

const entry: SmitheryModule = _entry

async function startMcpServer() {
	try {
		const port = process.env.PORT || "8181"

		console.log(`${chalk.blue("[smithery]")} Starting MCP server on port ${port}`)

		let server: { app: express.Application }

		const app = express()

		// Inject cors for development
		if (process.env.NODE_ENV !== "production") {
			console.log(`${chalk.blue("[smithery]")} Injecting cors middleware`)
			app.use(
				cors({
					exposedHeaders: ["mcp-session-id"],
				}),
			)
		}

		if (entry.default && typeof entry.default === "function") {
			console.log(`${chalk.blue("[smithery]")} Setting up ${entry.stateless ? "stateless" : "stateful"} server`)

			if (entry.stateless) {
				server = createStatelessServer(entry.default as CreateStatelessServerFn, {
					schema: entry.configSchema,
					app,
				})
			} else {
				server = createStatefulServer(entry.default as CreateStatefulServerFn, {
					schema: entry.configSchema,
					app,
				})
			}
		} else {
			throw new Error(
				"No valid server export found. Please export:\n" +
					"- export default function({ sessionId, config }) { ... } (stateful)\n" +
					"- export default function({ config }) { ... } (stateless)",
			)
		}

		// Start the server
		server.app.listen(Number.parseInt(port))
		console.log(`${chalk.green("[smithery]")} MCP server started successfully on port ${port}`)
	} catch (error) {
		console.error(`${chalk.red("[smithery]")} Failed to start MCP server:`, error)
		process.exit(1)
	}
}

// Start the server
startMcpServer()
