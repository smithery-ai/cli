#!/usr/bin/env node
import { APIConnectionTimeoutError } from "@smithery/api"
import { getConfig } from "../../lib/keychain"
import { resolveServer } from "../../lib/registry"
import type { ServerConfig } from "../../types/registry"
import { parseQualifiedName } from "../../utils/cli-utils"
import { prepareStdioConnection } from "../../utils/run/prepare-stdio-connection"
import { getApiKey, initializeSettings } from "../../utils/smithery-settings.js"
import { createStdioRunner as startSTDIOrunner } from "./stdio-runner.js"
import { logWithTimestamp } from "./utils.js"

/**
 * Runs a server with the specified configuration
 *
 * @param {string} qualifiedName - The qualified name of the server to run
 * @param {ServerConfig} configOverride - Optional configuration override (from --config flag)
 * @returns {Promise<void>} A promise that resolves when the server is running or fails
 * @throws {Error} If the server cannot be resolved or connection fails
 */
export async function run(qualifiedName: string, configOverride: ServerConfig) {
	try {
		const settingsResult = await initializeSettings()
		if (!settingsResult.success) {
			logWithTimestamp(
				`[Runner] Settings initialization warning: ${settingsResult.error}`,
			)
		}

		const { server, connection } = await resolveServer(
			parseQualifiedName(qualifiedName),
		)

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

				// @deprecated HTTP connections are deprecated. Use 'smithery install' instead.
				const timestamp = new Date().toISOString()
				console.error(
					`${timestamp} [DEPRECATED] Direct HTTP server execution is deprecated. Please use 'smithery install' to configure the server for your client instead.`,
				)

				// Convert HTTP connection to STDIO using mcp-remote (like install does for non-OAuth clients)
				// No API key needed - OAuth servers track remotely
				const args = ["-y", "mcp-remote", connection.deploymentUrl]
				const command = process.platform === "win32" ? "cmd" : "npx"
				const finalArgs =
					process.platform === "win32" ? ["/c", "npx", ...args] : args

				await startSTDIOrunner(
					command,
					finalArgs,
					{},
					server.qualifiedName,
					undefined, // No API key needed - OAuth servers track remotely
				)
				break
			}
			case "stdio": {
				// Read config from keychain, merge with override if provided (STDIO-specific)
				const keychainConfig = (await getConfig(qualifiedName)) || {}
				const config = { ...keychainConfig, ...configOverride }
				logWithTimestamp(
					`[Runner] Loaded config from keychain${Object.keys(configOverride).length > 0 ? " (with overrides)" : ""}`,
				)

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
		if (error instanceof APIConnectionTimeoutError) {
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
