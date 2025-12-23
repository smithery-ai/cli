#!/usr/bin/env node
import { RequestTimeoutError } from "@smithery/registry/models/errors"
import { getConfig } from "../../lib/keychain"
import { resolveServer } from "../../lib/registry"
import type { ServerConfig } from "../../types/registry"
import { prepareStdioConnection } from "../../utils/run/prepare-stdio-connection"
import { getApiKey, initializeSettings } from "../../utils/smithery-settings.js"
import { createStdioRunner as startSTDIOrunner } from "./stdio-runner.js"
import { createStreamableHTTPRunner } from "./streamable-http-runner.js"
import { logWithTimestamp } from "./utils.js"

/**
 * Runs a server with the specified configuration
 *
 * @param {string} qualifiedName - The qualified name of the server to run
 * @param {ServerConfig} configOverride - Optional configuration override (from --config flag)
 * @returns {Promise<void>} A promise that resolves when the server is running or fails
 * @throws {Error} If the server cannot be resolved or connection fails
 */
export async function run(
	qualifiedName: string,
	configOverride: ServerConfig,
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

		switch (connection.type) {
			case "http": {
				if (!connection.deploymentUrl) {
					throw new Error("Missing deployment URL")
				}

				// Get API key from global config for HTTP servers
				const apiKey = await getApiKey()
				if (!apiKey) {
					throw new Error(
						"API key required for HTTP servers. Please run 'smithery login' or install the server first.",
					)
				}

				await createStreamableHTTPRunner(connection.deploymentUrl)
				break
			}
			case "stdio": {
				const preparedConnection = await prepareStdioConnection(
					server,
					connection,
					config,
				)

				const apiKey = await getApiKey()
				await startSTDIOrunner(
					preparedConnection.command,
					preparedConnection.args,
					preparedConnection.env,
					preparedConnection.qualifiedName,
					apiKey,
				)
				break
			}
			default:
				throw new Error(
					`Unsupported connection type: ${(connection as { type: string }).type}`,
				)
		}
	} catch (error) {
		if (error instanceof RequestTimeoutError) {
			logWithTimestamp(
				"[Runner] Error: Request timed out. Please check your connection and try again.",
			)
		} else {
			logWithTimestamp(
				`[Runner] Error: ${error instanceof Error ? error.message : error}`,
			)
		}
		process.exit(1)
	}
}
