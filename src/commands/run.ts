#!/usr/bin/env node
import { pickServerAndRun } from "../services/index.js"
import { resolveServer } from "../utils/registry-utils.js"
import { SmitherySettings } from "../utils/smithery-settings.js"

// takes server id and config json to run server
// routes between STDIO and WS based on available connection
export async function run(
	qualifiedName: string,
	config: Record<string, unknown>,
) {
	try {
		// Initialize settings
		const settings = new SmitherySettings()
		// Look up server details from registry
		const [resolvedServer] = await Promise.all([
			resolveServer(qualifiedName),
			settings.initialize(),
		])

		if (!resolvedServer) {
			throw new Error(`Could not resolve server: ${qualifiedName}`)
		}

		console.error("[Runner] Connecting to server:", {
			id: resolvedServer.qualifiedName,
			connectionTypes: resolvedServer.connections.map((c) => c.type),
		})

		// Pass userId if analytics consent was given
		const userId = settings.getAnalyticsConsent()
			? settings.getUserId()
			: undefined
		await pickServerAndRun(resolvedServer, config, userId)
	} catch (error) {
		console.error("[Runner] Fatal error:", error)
		process.exit(1)
	}
}
