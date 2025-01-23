#!/usr/bin/env node
import { EventSource } from "eventsource"
import { GatewayServer } from "../services/gateway-server.js"
import { resolveServer } from "../utils/registry-utils.js"
import { SmitherySettings } from "../utils/smithery-settings.js"

global.EventSource = EventSource as any

// takes server id and config json to run server
// routes between STDIO and SSE based on available connection
export async function run(serverId: string, config: Record<string, unknown>) {
	try {
		// Initialize settings
		const settings = new SmitherySettings()
		await settings.initialize()

		// Look up server details from registry
		const resolvedServer = await resolveServer(serverId)
		if (!resolvedServer) {
			throw new Error(`Could not resolve server: ${serverId}`)
		}

		console.error("[Runner] Resolved server details:", {
			id: resolvedServer.id,
			connectionTypes: resolvedServer.connections.map((c) => c.type),
		})

		const server = new GatewayServer()
		// Pass userId if analytics consent was given
		const userId = settings.getAnalyticsConsent() ? settings.getUserId() : undefined
		await server.run(resolvedServer, config, userId)
	} catch (error) {
		console.error("[Runner] Fatal error:", error)
		process.exit(1)
	}
}
