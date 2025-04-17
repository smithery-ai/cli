#!/usr/bin/env node
import { fetchConfigWithApiKey, resolvePackage } from "../../registry.js"
import {
	getAnalyticsConsent,
	initializeSettings,
} from "../../smithery-config.js"
import type { RegistryServer, ServerConfig } from "../../types/registry.js"
import {
	chooseConnection,
	validateAndFormatConfig,
} from "../../utils/config.js"
import { createStdioRunner as startSTDIOrunner } from "./stdio-runner.js"
import { createWSRunner as startWSRunner } from "./ws-runner.js"
import { logWithTimestamp } from "./runner-utils.js"

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
			logWithTimestamp(
				`[Runner] Settings initialization warning: ${settingsResult.error}`,
			)
		}

		let resolvedServer: RegistryServer | null = null
		let finalConfig = config

		// If API key is provided, fetch both config and server info in one call
		if (apiKey) {
			try {
				const result = await fetchConfigWithApiKey(qualifiedName, apiKey)
				resolvedServer = result.server
				// Merge configs with proper schema validation
				const connection = chooseConnection(result.server)
				finalConfig = await validateAndFormatConfig(connection, {
					...result.config,
					...config,
				})
				logWithTimestamp("[Runner] Using saved configuration")
			} catch (error) {
				logWithTimestamp(
					`[Runner] Failed to fetch config with API key: ${error}`,
				)
				logWithTimestamp("[Runner] Falling back to standard resolution")
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

		// Format final config with schema validation if not already done
		if (!apiKey) {
			const connection = chooseConnection(resolvedServer)
			finalConfig = await validateAndFormatConfig(connection, finalConfig)
		}

		logWithTimestamp(
			`[Runner] Connecting to server: ${JSON.stringify({
				id: resolvedServer.qualifiedName,
				connectionTypes: resolvedServer.connections.map((c) => c.type),
			})}`,
		)

		const analyticsEnabled = await getAnalyticsConsent()
		await pickServerAndRun(
			resolvedServer,
			finalConfig,
			apiKey,
			analyticsEnabled,
		)
	} catch (error) {
		logWithTimestamp(
			`[Runner] Error: ${error instanceof Error ? error.message : error}`,
		)
		process.exit(1)
	}
}

/**
 * Picks the correct runner and starts the server based on available connection types.
 *
 * @param {RegistryServer} serverDetails - Details of the server to run, including connection options
 * @param {ServerConfig} config - Configuration values for the server
 * @param {string} [apiKey] - Required for WS connections. Optional for stdio connections.
 * @returns {Promise<void>} A promise that resolves when the server is running
 * @throws {Error} If connection type is unsupported or deployment URL is missing for WS connections
 * @private
 */
async function pickServerAndRun(
	serverDetails: RegistryServer,
	config: ServerConfig,
	apiKey: string | undefined,
	analyticsEnabled: boolean,
): Promise<void> {
	const connection = chooseConnection(serverDetails)

	if (connection.type === "ws") {
		if (!connection.deploymentUrl) {
			throw new Error("Missing deployment URL")
		}
		await startWSRunner(connection.deploymentUrl, config, apiKey)
	} else if (connection.type === "stdio") {
		await startSTDIOrunner(serverDetails, config, apiKey, analyticsEnabled)
	} else {
		throw new Error(
			`Unsupported connection type: ${(connection as { type: string }).type}`,
		)
	}
}
