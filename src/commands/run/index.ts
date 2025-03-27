#!/usr/bin/env node
import { resolvePackage, fetchConfigWithApiKey } from "../../registry.js"
import type { RegistryServer } from "../../types/registry.js"
import { createWSRunner as startWSRunner } from "./ws-runner.js"
import { createStdioRunner as startSTDIOrunner } from "./stdio-runner.js"
import {
	initializeSettings,
	getAnalyticsConsent,
	getUserId,
} from "../../smithery-config.js"
import { chooseConnection } from "../../utils/config.js"
import type { ServerConfig } from "../../types/registry.js"

/**
 * Runs a server with the specified configuration
 *
 * @param {string} qualifiedName - The qualified name of the server to run
 * @param {ServerConfig} config - Configuration values for the server
 * @param {string} [apiKey] - Optional API key to fetch saved configuration
 * @returns {Promise<void>} A promise that resolves when the server is running or fails
 * @throws {Error} If the server cannot be resolved or connection fails
 */
export async function run(
	qualifiedName: string,
	config: ServerConfig,
	apiKey?: string,
) {
	try {
		const settingsResult = await initializeSettings()
		if (!settingsResult.success) {
			console.warn(
				"[Runner] Settings initialization warning:",
				settingsResult.error,
			)
		}

		let resolvedServer: RegistryServer | null = null
		let finalConfig = config

		// If API key is provided, fetch both config and server info in one call
		if (apiKey) {
			try {
				const result = await fetchConfigWithApiKey(qualifiedName, apiKey)
				resolvedServer = result.server
				finalConfig = { ...result.config, ...config } // Merge configs, with local config taking precedence
				console.error("[Runner] Using saved configuration")
			} catch (error) {
				console.error("[Runner] Failed to fetch config with API key:", error)
				console.error("[Runner] Falling back to standard resolution")
				resolvedServer = null // Ensure we do a fresh resolution below
			}
		}

		// If we still don't have a server (either no API key or API key fetch failed)
		if (!resolvedServer) {
			resolvedServer = await resolvePackage(qualifiedName)
		}

		if (!resolvedServer) {
			throw new Error(`Could not resolve server: ${qualifiedName}`)
		}

		console.error("[Runner] Connecting to server:", {
			id: resolvedServer.qualifiedName,
			connectionTypes: resolvedServer.connections.map((c) => c.type),
		})

		const analyticsEnabled = await getAnalyticsConsent()
		const userId = analyticsEnabled ? await getUserId() : undefined
		await pickServerAndRun(resolvedServer, finalConfig, userId, apiKey)
	} catch (error) {
		console.error("[Runner] Fatal error:", error)
		process.exit(1)
	}
}

/**
 * Picks the correct runner and starts the server based on available connection types.
 *
 * @param {RegistryServer} serverDetails - Details of the server to run, including connection options
 * @param {ServerConfig} config - Configuration values for the server
 * @param {string} [userId] - Optional user ID for analytics tracking
 * @param {string} [apiKey] - Optional API key for WS connections
 * @returns {Promise<void>} A promise that resolves when the server is running
 * @throws {Error} If connection type is unsupported or deployment URL is missing for WS connections
 * @private
 */
async function pickServerAndRun(
	serverDetails: RegistryServer,
	config: ServerConfig,
	userId?: string,
	apiKey?: string,
): Promise<void> {
	const connection = chooseConnection(serverDetails)

	if (connection.type === "ws") {
		if (!connection.deploymentUrl) {
			throw new Error("Missing deployment URL")
		}
		await startWSRunner(connection.deploymentUrl, config, apiKey)
	} else if (connection.type === "stdio") {
		await startSTDIOrunner(serverDetails, config, userId)
	} else {
		throw new Error(
			`Unsupported connection type: ${(connection as { type: string }).type}`,
		)
	}
}
