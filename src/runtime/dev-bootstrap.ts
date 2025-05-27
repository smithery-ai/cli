// This file gets injected into the user's bundled MCP server
// It imports their default export and starts the server

import type { CreateServerFn as CreateStatefulServerFn } from "@smithery/sdk/server/stateful.js"
import type { CreateServerFn as CreateStatelessServerFn } from "@smithery/sdk/server/stateless.js"
import type { Express } from "express"

// Type declaration for the injected entry module
interface SmitheryModule {
	// Named exports
	createStatefulServer?: CreateStatefulServerFn
	createStatelessServer?: CreateStatelessServerFn
}

// Identifier replaced by esbuild define with actual path string
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
declare const __SMITHERY_ENTRY__: string
;(async () => {
	try {
		// Import the user's entry file (replaced by esbuild define)
		const entry: SmitheryModule = await import(__SMITHERY_ENTRY__)

		// Check for named exports first
		let serverApp: Express

		if (
			entry.createStatefulServer &&
			typeof entry.createStatefulServer === "function"
		) {
			// User exported a createStatefulServer function
			const { createStatefulServer } = await import(
				"@smithery/sdk/server/stateful.js"
			)
			const { app } = createStatefulServer(entry.createStatefulServer)
			serverApp = app
		} else if (
			entry.createStatelessServer &&
			typeof entry.createStatelessServer === "function"
		) {
			// User exported a createStatelessServer function
			const { createStatelessServer } = await import(
				"@smithery/sdk/server/stateless.js"
			)
			const { app } = createStatelessServer(entry.createStatelessServer)
			serverApp = app
		} else {
			// Fallback to default export for backward compatibility
			throw new Error(
				"Must export either a named createStatefulServer or createStatelessServer function.\n" +
					"Examples:\n\n" +
					"  // Stateless server:\n" +
					"  export function createStatelessServer({ config }) {\n" +
					"    const server = new McpServer({ name: 'My Server', version: '1.0.0' });\n" +
					"    return server.server;\n" +
					"  }\n\n" +
					"  // Stateful server:\n" +
					"  export function createStatefulServer({ sessionId, config }) {\n" +
					"    const server = new McpServer({ name: 'My Server', version: '1.0.0' });\n" +
					"    return server.server;\n" +
					"  }",
			)
		}

		// Get port from environment or default to 8181
		const port = Number(process.env.PORT) || 8181

		// Start the server
		serverApp.listen(port, () => {
			console.log(`[smithery] MCP server listening on http://localhost:${port}`)
		})

		// Handle graceful shutdown
		process.on("SIGTERM", () => {
			console.log("[smithery] Received SIGTERM, shutting down gracefully")
			process.exit(0)
		})

		process.on("SIGINT", () => {
			console.log("[smithery] Received SIGINT, shutting down gracefully")
			process.exit(0)
		})
	} catch (error) {
		console.error("[smithery] Failed to start MCP server:", error)
		process.exit(1)
	}
})()
