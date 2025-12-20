#!/usr/bin/env node
import type {
	ConnectionInfo,
	ServerDetailResponse,
} from "@smithery/registry/models/components"
import { getConfig } from "../../lib/keychain.js"
import { resolveServer } from "../../lib/registry.js"
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
 * @param {ServerConfig} configOverride - Optional configuration override (from --config flag)
 * @param {RunOptions} [options] - Additional options for playground functionality
 * @returns {Promise<void>} A promise that resolves when the server is running or fails
 * @throws {Error} If the server cannot be resolved or connection fails
 */
export async function run(
	qualifiedName: string,
	configOverride: ServerConfig,
	options?: RunOptions,
) {
	try {
		const settingsResult = await initializeSettings()
		if (!settingsResult.success) {
			logWithTimestamp(
				`[Runner] Settings initialization warning: ${settingsResult.error}`,
			)
		}

		// Read config from keychain, merge with override if provided
		const keychainConfig = (await getConfig(qualifiedName)) || {}
		const config = { ...keychainConfig, ...configOverride }
		logWithTimestamp(
			`[Runner] Loaded config from keychain${Object.keys(configOverride).length > 0 ? " (with overrides)" : ""}`,
		)

		const { server, connection } = await resolveServer(qualifiedName)

		logWithTimestamp(
			`[Runner] Connecting to server: ${JSON.stringify({
				id: server.qualifiedName,
				connectionType: connection.type,
			})}`,
		)

		const analyticsEnabled = await getAnalyticsConsent()
		await pickServerAndRun(
			server,
			connection,
			config,
			analyticsEnabled,
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
	connection: ConnectionInfo,
	config: ServerConfig,
	analyticsEnabled: boolean,
	options?: RunOptions,
): Promise<void> {
	if (connection.type === "http") {
		if (!connection.deploymentUrl) {
			throw new Error("Missing deployment URL")
		}
		// Note: HTTP server execution temporarily broken - will be fixed in future refactor
		// For now, leave as-is per plan
		if (options?.playground) {
			await createUplinkRunner(
				connection.deploymentUrl,
				"", // API key placeholder - will be fixed later
				config,
				undefined, // No profile
				{
					open: options.open !== false,
					initialMessage: options.initialMessage || "Say hello to the world!",
				},
			)
		} else {
			await createStreamableHTTPRunner(
				connection.deploymentUrl,
				"", // API key placeholder - will be fixed later
				config,
				undefined, // No profile
			)
		}
	} else if (connection.type === "stdio") {
		const preparedConnection = await prepareStdioConnection(
			serverDetails,
			connection,
			config,
		)

		if (options?.playground) {
			// Note: Playground may require API key - will be addressed in future refactor
			await createLocalPlaygroundRunner(
				preparedConnection.command,
				preparedConnection.args,
				preparedConnection.env,
				preparedConnection.qualifiedName,
				"", // API key placeholder - will be fixed later
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
				undefined, // No API key needed
				analyticsEnabled,
			)
		}
	} else {
		throw new Error(
			`Unsupported connection type: ${(connection as { type: string }).type}`,
		)
	}
}
