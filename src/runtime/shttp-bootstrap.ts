// These will be replaced by esbuild at build time.
// @ts-expect-error
import * as _entry from "virtual:user-module"
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js"
import {
	type CallbackOAuthServerProvider,
	type IdentityHandler,
	mountOAuth,
} from "@smithery/sdk"
import {
	type CreateServerFn as CreateStatefulServerFn,
	createStatefulServer,
} from "@smithery/sdk/server/stateful.js"
import {
	type CreateStatelessServerFn,
	createStatelessServer,
} from "@smithery/sdk/server/stateless.js"
import chalk from "chalk"
import cors from "cors"
import express from "express"
import type { z } from "zod"
import { DEFAULT_PORT } from "../constants.js"

// Type declaration for the user module
interface SmitheryModule {
	configSchema?: z.ZodSchema
	stateless?: boolean
	// Default export (can be stateful or stateless server)
	default?: CreateStatefulServerFn | CreateStatelessServerFn
	// Optional OAuth provider instance. Provider carries its own options.
	oauth?: CallbackOAuthServerProvider | OAuthTokenVerifier
	identity?: IdentityHandler
}

const entry: SmitheryModule = _entry

async function startMcpServer() {
	try {
		const port = process.env.PORT || DEFAULT_PORT.toString()

		let server: { app: express.Application }

		const app = express()

		// Inject cors for development
		if (process.env.NODE_ENV !== "production") {
			console.log(`${chalk.dim("> Injecting cors middleware")}`)
			app.use(
				cors({
					exposedHeaders: ["mcp-session-id"],
				}),
			)
		}

		// Auto-wire OAuth and/or Identity if configured
		if (entry.oauth) {
			console.log(chalk.dim(`> OAuth detected. Mounting auth routes.`))
		}
		if (entry.identity) {
			console.log(chalk.dim(`> Identity detected. Mounting identity routes.`))
		}
		if (entry.oauth || entry.identity) {
			mountOAuth(app, { provider: entry.oauth, identity: entry.identity })
		}

		if (entry.default && typeof entry.default === "function") {
			console.log(
				chalk.dim(
					`> Setting up ${entry.stateless ? "stateless" : "stateful"} server`,
				),
			)

			// Show detected config schema
			if (entry.configSchema) {
				try {
					const { zodToJsonSchema } = await import("zod-to-json-schema")
					const schema = zodToJsonSchema(entry.configSchema) as any
					const total = Object.keys(schema.properties || {}).length
					const required = (schema.required || []).length
					if (total > 0)
						console.log(
							chalk.dim(
								`> Config schema: ${total} field${total === 1 ? "" : "s"} (${required} required)`,
							),
						)
				} catch {
					console.log(chalk.dim(`> Config schema detected`))
				}
			}

			const oauth = entry.oauth
			if (oauth) {
			}

			if (entry.stateless) {
				server = createStatelessServer(
					entry.default as CreateStatelessServerFn,
					{ app, schema: entry.configSchema },
				)
			} else {
				server = createStatefulServer(entry.default as CreateStatefulServerFn, {
					app,
					schema: entry.configSchema,
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
		server.app.listen(Number.parseInt(port, 10))
		// console.log(
		// 	`${chalk.green("[smithery]")} MCP server started successfully on port ${port}`,
		// )
	} catch (error) {
		console.error(`${chalk.red("✗ Failed to start MCP server:")}`, error)
		process.exit(1)
	}
}

// Start the server
startMcpServer()
