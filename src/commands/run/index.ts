#!/usr/bin/env node
import type { ServerDetailResponse } from "@smithery/registry/models/components"
import { ResolveServerSource, resolveServer } from "../../lib/registry.js"
import type { ServerConfig } from "../../types/registry.js"
import { chooseConnection } from "../../utils/session-config.js"
import {
	getAnalyticsConsent,
	initializeSettings,
} from "../../utils/smithery-config.js"
import { createLocalPlaygroundRunner } from "./local-playground-runner.js"
import { logWithTimestamp } from "./runner-utils.js"
import { createStdioRunner as startSTDIOrunner } from "./stdio-runner.js"
import { createStreamableHTTPRunner } from "./streamable-http-runner.js"
import { createUplinkRunner } from "./uplink-runner.js"

interface RunOptions {
	playground?: boolean
	open?: boolean
	initialMessage?: string
}

/**
 * Runs a server with the specified configuration
 *
 * @param {string} qualifiedName - The qualified name of the server to run
 * @param {ServerConfig} config - Configuration values for the server
 * @param {string} apiKey - API key required for authentication
 * @param {string} [profile] - Optional profile name to use
 * @param {RunOptions} [options] - Additional options for playground functionality
 * @returns {Promise<void>} A promise that resolves when the server is running or fails
 * @throws {Error} If the server cannot be resolved or connection fails
 */
export async function run(
	qualifiedName: string,
	config: ServerConfig,
	apiKey: string | undefined,
	profile?: string,
	options?: RunOptions,
) {
	try {
		const settingsResult = await initializeSettings()
		if (!settingsResult.success) {
			logWithTimestamp(
				`[Runner] Settings initialization warning: ${settingsResult.error}`,
			)
		}

		const resolvedServer = await resolveServer(
			qualifiedName,
			apiKey,
			ResolveServerSource.Run,
		)
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
			options,
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
 * @param {ServerDetailResponse} serverDetails - Details of the server to run, including connection options
 * @param {ServerConfig} config - Configuration values for the server
 * @param {boolean} analyticsEnabled - Whether analytics are enabled for the server
 * @param {string} [apiKey] - Required for WS connections. Optional for stdio connections.
 * @param {string} [profile] - Optional profile name to use
 * @param {RunOptions} [options] - Additional options for playground functionality
 * @returns {Promise<void>} A promise that resolves when the server is running
 * @throws {Error} If connection type is unsupported or deployment URL is missing for WS connections
 * @private
 */
async function pickServerAndRun(
	serverDetails: ServerDetailResponse,
	config: ServerConfig,
	analyticsEnabled: boolean,
	apiKey: string | undefined, // can be undefined because of optionality for local servers
	profile: string | undefined,
	options?: RunOptions,
): Promise<void> {
	const connection = chooseConnection(serverDetails)

	// If playground option is enabled, choose the appropriate playground runner
	if (options?.playground) {
		if (!apiKey) {
			throw new Error("API key is required for playground connections")
		}

		if (connection.type === "http") {
			// Remote playground mode - connect to deployed server via HTTP
			if (!connection.deploymentUrl) {
				throw new Error("Missing deployment URL")
			}
			await createUplinkRunner(
				connection.deploymentUrl,
				apiKey,
				config,
				profile,
				{
					open: options.open !== false, // default to true
					initialMessage: options.initialMessage || "Say hello to the world!",
				},
			)
		} else if (connection.type === "stdio") {
			// Local playground mode - start local STDIO server with HTTP tunnel
			await createLocalPlaygroundRunner(serverDetails, config, apiKey, {
				open: options.open !== false, // default to true
				initialMessage: options.initialMessage || "Say hello to the world!",
			})
		} else {
			throw new Error(
				`Playground functionality does not support ${connection.type} connections`,
			)
		}
		return
	}

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
