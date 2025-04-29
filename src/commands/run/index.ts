#!/usr/bin/env node
import { resolvePackage } from "../../registry.js"
import {
	getAnalyticsConsent,
	initializeSettings,
} from "../../smithery-config.js"
import type { RegistryServer, ServerConfig } from "../../types/registry.js"
import { chooseConnection } from "../../utils/config.js"
import { createStdioRunner as startSTDIOrunner } from "./stdio-runner.js"
import { logWithTimestamp } from "./runner-utils.js"
import { createStreamableHTTPRunner } from "./streamable-http-runner.js"

/**
 * Runs a server with the specified configuration
 *
 * @param {string} qualifiedName - The qualified name of the server to run
 * @param {ServerConfig} config - Configuration values for the server
 * @param {string} apiKey - API key required for authentication
 * @param {string} [profile] - Optional profile name to use
 * @returns {Promise<void>} A promise that resolves when the server is running or fails
 * @throws {Error} If the server cannot be resolved or connection fails
 */
export async function run(
	qualifiedName: string,
	config: ServerConfig,
	apiKey: string | undefined,
	profile?: string,
) {
	try {
		const settingsResult = await initializeSettings()
		if (!settingsResult.success) {
			logWithTimestamp(
				`[Runner] Settings initialization warning: ${settingsResult.error}`,
			)
		}

		const resolvedServer = await resolvePackage(qualifiedName)
		if (!resolvedServer) {
			throw new Error(`Could not resolve server: ${qualifiedName}`)
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
			config,
			analyticsEnabled,
			apiKey,
			profile,
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
 * @param {boolean} analyticsEnabled - Whether analytics are enabled for the server
 * @param {string} [apiKey] - Required for WS connections. Optional for stdio connections.
 * @returns {Promise<void>} A promise that resolves when the server is running
 * @throws {Error} If connection type is unsupported or deployment URL is missing for WS connections
 * @private
 */
async function pickServerAndRun(
	serverDetails: RegistryServer,
	config: ServerConfig,
	analyticsEnabled: boolean,
	apiKey: string | undefined, // can be undefined because of optionality for local servers
	profile: string | undefined,
): Promise<void> {
	const connection = chooseConnection(serverDetails)

	if (connection.type === "http") {
		if (!connection.deploymentUrl) {
			throw new Error("Missing deployment URL")
		}
		if (!apiKey) {
			// eventually make it required for all connections
			throw new Error("API key is required for remote connections")
		}
		await createStreamableHTTPRunner(
			connection.deploymentUrl,
			apiKey, // api key can't be undefined here
			config,
			profile, // profile can be undefined
		)
	} else if (connection.type === "stdio") {
		await startSTDIOrunner(serverDetails, config, apiKey, analyticsEnabled) // here, api key can be undefined
	} else {
		throw new Error(
			`Unsupported connection type: ${(connection as { type: string }).type}`,
		)
	}
}
