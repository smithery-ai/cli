import type { ServerGetResponse } from "@smithery/api/resources/servers/servers"
import { getClientConfiguration } from "../../config/clients.js"

type Connection =
	| ServerGetResponse.StdioConnection
	| ServerGetResponse.HTTPConnection

export type TransportType = "stdio" | "http-oauth" | "http-proxy"

export interface ResolvedTransport {
	type: TransportType
	needsUserConfig: boolean
}

/**
 * Single source of truth for transport resolution.
 *
 * @param connection - The selected connection from registry
 * @param client - The target client name
 * @returns Transport type and whether user config collection is needed
 */
export function resolveTransport(
	connection: Connection,
	client: string,
): ResolvedTransport {
	const clientConfig = getClientConfiguration(client)

	if (connection.type === "http") {
		if (clientConfig.transports.http?.supportsOAuth) {
			return { type: "http-oauth", needsUserConfig: false }
		}
		// Use mcp-remote as proxy for clients without OAuth
		return { type: "http-proxy", needsUserConfig: false }
	}

	// STDIO requires user config (API keys, etc.)
	return { type: "stdio", needsUserConfig: true }
}
