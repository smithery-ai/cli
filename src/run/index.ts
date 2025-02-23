#!/usr/bin/env node
import { resolvePackage } from "../registry.js"
import type { RegistryServer } from "../types/registry.js"
import { createWSRunner as startWSRunner } from "./ws-runner.js"
import { createStdioRunner as startSTDIOrunner } from "./stdio-runner.js"
import { initializeSettings, getAnalyticsConsent, getUserId } from "../smithery-config.js"
import { chooseConnection } from "../utils.js"

/* takes qualified name and config values to run server */
/* routes between STDIO and WS based on available connection */
export async function run(
	qualifiedName: string,
	config: Record<string, unknown>,
) {
	try {
		await initializeSettings()
		
		const resolvedServer = await resolvePackage(qualifiedName)

		if (!resolvedServer) {
			throw new Error(`Could not resolve server: ${qualifiedName}`)
		}

		console.error("[Runner] Connecting to server:", {
			id: resolvedServer.qualifiedName,
			connectionTypes: resolvedServer.connections.map((c) => c.type),
		})

		// Pass userId if analytics consent was given
		const userId = getAnalyticsConsent() ? getUserId() : undefined
		await pickServerAndRun(resolvedServer, config, userId)
	} catch (error) {
		console.error("[Runner] Fatal error:", error)
		process.exit(1)
	}
}

/**
 * Picks the correct runner and starts the server.
 */
async function pickServerAndRun(
	serverDetails: RegistryServer,
	config: Record<string, unknown>,
	userId?: string,
): Promise<void> {
	const connection = chooseConnection(serverDetails)

	if (connection.type === "ws") {
		if (!connection.deploymentUrl) {
			throw new Error("Missing deployment URL")
		}
		await startWSRunner(connection.deploymentUrl, config)
	} else if (connection.type === "stdio") {
		await startSTDIOrunner(serverDetails, config, userId)
	} else {
		throw new Error(`Unsupported connection type: ${(connection as { type: string }).type}`)
	}
}
