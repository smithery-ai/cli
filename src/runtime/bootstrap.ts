// Universal bootstrap for both dev and production builds
import type { CreateServerFn as CreateStatefulServerFn } from "@smithery/sdk/server/stateful.js"
import type { CreateServerFn as CreateStatelessServerFn } from "@smithery/sdk/server/stateless.js"

// Type declaration for the user module
interface SmitheryModule {
	// Named exports
	createStatefulServer?: CreateStatefulServerFn
	createStatelessServer?: CreateStatelessServerFn
	// Default export (backward compatibility)
	default?: CreateStatelessServerFn
}

// These will be replaced by esbuild at build time
declare const __SMITHERY_ENTRY__: string | undefined // Dev mode: dynamic import path
declare const __SMITHERY_USER_MODULE__: any | undefined // Prod mode: static import

async function startMcpServer() {
	try {
		const port = process.env.PORT || "8181"
		const config = process.env.SMITHERY_CONFIG
			? JSON.parse(process.env.SMITHERY_CONFIG)
			: {}

		console.log(`[smithery] Starting MCP server on port ${port}`)

		// Load user module - different approach for dev vs prod
		let entry: SmitheryModule

		if (typeof __SMITHERY_ENTRY__ !== "undefined") {
			// Dev mode: dynamic import
			entry = await import(__SMITHERY_ENTRY__)
		} else {
			// Production mode: static import (already bundled)
			// @ts-ignore - This will be replaced by esbuild alias plugin
			entry = await import("__SMITHERY_USER_MODULE__")
		}

		let server: any

		if (
			entry.createStatefulServer &&
			typeof entry.createStatefulServer === "function"
		) {
			// Stateful server
			console.log(`[smithery] Creating stateful server.`)

			const { createStatefulServer } = await import(
				"@smithery/sdk/server/stateful.js"
			)
			server = createStatefulServer(entry.createStatefulServer)
		} else if (
			entry.createStatelessServer &&
			typeof entry.createStatelessServer === "function"
		) {
			// Stateless server
			console.log(`[smithery] Creating stateless server`)

			const { createStatelessServer } = await import(
				"@smithery/sdk/server/stateless.js"
			)
			server = createStatelessServer(entry.createStatelessServer)
		} else if (entry.default && typeof entry.default === "function") {
			// Default export (backward compatibility - treat as stateless)
			console.log(`[smithery] Creating stateless server from default export`)

			const { createStatelessServer } = await import(
				"@smithery/sdk/server/stateless.js"
			)
			server = createStatelessServer(entry.default)
		} else {
			throw new Error(
				"No valid server export found. Please export either:\n" +
					"- export function createStatefulServer({ sessionId, config }) { ... }\n" +
					"- export function createStatelessServer({ config }) { ... }\n" +
					"- export default function({ config }) { ... }",
			)
		}

		// Start the server
		await server.app.listen(Number.parseInt(port))
		console.log(`[smithery] MCP server started successfully on port ${port}`)
	} catch (error) {
		console.error(`[smithery] Failed to start MCP server:`, error)
		process.exit(1)
	}
}

// Start the server
startMcpServer()
