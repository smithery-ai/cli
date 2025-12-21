import type {
	ConnectionInfo,
	ServerDetailResponse,
} from "@smithery/registry/models/components"
import { getClientConfiguration } from "../config/clients"
import type {
	ConfiguredServer,
	StreamableHTTPConnection,
} from "../types/registry"

type ConfigType = "http-oauth" | "http-no-oauth" | "stdio"

/**
 * Creates HTTP server configuration for clients that support it
 * @param qualifiedName - The fully qualified name of the server package
 * @param client - Optional client name
 * @returns HTTP configuration
 */
function createHTTPServerConfig(
	qualifiedName: string,
	_client?: string,
): StreamableHTTPConnection {
	// Build the HTTP URL for the server - OAuth handles auth, no query params needed
	const url = `https://server.smithery.ai/${qualifiedName}/mcp`

	return {
		type: "http",
		url,
		headers: {},
	}
}

/**
 * Creates STDIO configuration using mcp-remote for HTTP servers with non-OAuth clients
 * @param qualifiedName - The fully qualified name of the server package
 * @returns STDIO configuration with mcp-remote command
 */
function createMcpRemoteConfig(qualifiedName: string): ConfiguredServer {
	const url = `https://server.smithery.ai/${qualifiedName}/mcp`
	const args = ["-y", "mcp-remote", url]

	/* Use cmd /c for Windows platforms */
	if (process.platform === "win32") {
		return {
			command: "cmd",
			args: ["/c", "npx", ...args],
		}
	}

	// Default for non-Windows platforms
	return {
		command: "npx",
		args,
	}
}

/**
 * Creates STDIO configuration for standard server execution
 * @param qualifiedName - The fully qualified name of the server package
 * @returns STDIO configuration
 */
function createStdioConfig(qualifiedName: string): ConfiguredServer {
	// Base arguments for npx command - no flags needed, keychain handles config
	const npxArgs = ["-y", "@smithery/cli@latest", "run", qualifiedName]

	/* Use cmd /c for Windows platforms */
	if (process.platform === "win32") {
		return {
			command: "cmd",
			args: ["/c", "npx", ...npxArgs],
		}
	}

	// Default for non-Windows platforms
	return {
		command: "npx",
		args: npxArgs,
	}
}

/**
 * Determines the configuration type based on client and server capabilities
 * @param client - Client name
 * @param server - Server details
 * @returns The configuration type to use
 */
function determineConfigType(
	client: string,
	server: ServerDetailResponse,
): ConfigType {
	const clientConfig = getClientConfiguration(client)

	// Check if server supports HTTP
	const serverHasHTTP = server.connections?.some(
		(conn: ConnectionInfo) => conn.type === "http",
	)

	// If server has HTTP, check OAuth support
	if (serverHasHTTP) {
		if (clientConfig.supportsOAuth) {
			return "http-oauth"
		}
		// For non-OAuth HTTP servers, use mcp-remote as fallback
		return "http-no-oauth"
	}

	// Default to STDIO
	return "stdio"
}

/**
 * Formats server configuration into a standardized command structure
 * @param qualifiedName - The fully qualified name of the server package
 * @param client - Client name to determine transport type
 * @param server - Server details to check for HTTP support
 * @returns Configured server with command and arguments
 */
export function formatServerConfig(
	qualifiedName: string,
	client: string,
	server: ServerDetailResponse,
): ConfiguredServer {
	const configType = determineConfigType(client, server)

	switch (configType) {
		case "http-oauth":
			return createHTTPServerConfig(qualifiedName, client)
		case "http-no-oauth":
			return createMcpRemoteConfig(qualifiedName)
		case "stdio":
			return createStdioConfig(qualifiedName)
	}
}
