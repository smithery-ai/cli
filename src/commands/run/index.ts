#!/usr/bin/env node
import type { ServerDetailResponse } from "@smithery/registry/models/components"
import { ResolveServerSource, resolveServer } from "../../lib/registry.js"
import type { ServerConfig } from "../../types/registry.js"
import { prepareStdioConnection } from "../../utils/prepare-stdio-connection.js"
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

async function pickServerAndRun(
	serverDetails: ServerDetailResponse,
	config: ServerConfig,
	analyticsEnabled: boolean,
	apiKey: string | undefined, // can be undefined because of optionality for local servers
	profile: string | undefined,
	options?: RunOptions,
): Promise<void> {
	if (!serverDetails.connections?.length) {
		throw new Error("No connection configuration found for server")
	}

	const connection = serverDetails.connections[0]

	if (connection.type === "http") {
		if (!connection.deploymentUrl) {
			throw new Error("Missing deployment URL")
		}
		if (!apiKey) {
			throw new Error("API key is required for remote connections")
		}

		if (options?.playground) {
			await createUplinkRunner(
				connection.deploymentUrl,
				apiKey,
				config,
				profile,
				{
					open: options.open !== false,
					initialMessage: options.initialMessage || "Say hello to the world!",
				},
			)
		} else {
			await createStreamableHTTPRunner(
				connection.deploymentUrl,
				apiKey,
				config,
				profile,
			)
		}
	} else if (connection.type === "stdio") {
		const preparedConnection = await prepareStdioConnection(
			serverDetails,
			connection,
			config,
			apiKey,
		)

		if (options?.playground) {
			if (!apiKey) {
				throw new Error("API key is required for playground connections")
			}
			await createLocalPlaygroundRunner(
				preparedConnection.command,
				preparedConnection.args,
				preparedConnection.env,
				preparedConnection.qualifiedName,
				apiKey,
				{
					open: options.open !== false,
					initialMessage: options.initialMessage || "Say hello to the world!",
				},
			)
		} else {
			await startSTDIOrunner(
				preparedConnection.command,
				preparedConnection.args,
				preparedConnection.env,
				preparedConnection.qualifiedName,
				apiKey,
				analyticsEnabled,
			)
		}
	} else {
		throw new Error(
			`Unsupported connection type: ${(connection as { type: string }).type}`,
		)
	}
}
