import type { ServerConfig } from "../types/registry"

/**
 * @deprecated
 * To be replaced with createSmitheryURL from sdk
 * Configuration type for runners
 * Creates a URL for the Streamable HTTP transport
 * @param baseUrl The base URL to start with
 * @param config Configuration object
 * @param apiKey API key (required)
 * @param profile Optional profile name
 * @returns A URL object with properly encoded parameters and MCP path prefix
 */
export function createStreamableHTTPTransportUrl(
	baseUrl: string,
	apiKey: string, // api key is required
	config: ServerConfig | Record<string, never>,
	profile: string | undefined,
): URL {
	const url = new URL(baseUrl)

	if (process.env.NODE_ENV === "development") {
		const local = new URL(
			process.env.LOCAL_SERVER_URL || "http://localhost:8080",
		)
		url.protocol = local.protocol
		url.hostname = local.hostname
		url.port = local.port
	}

	// Add config as base64 encoded parameter
	if (config) {
		const configStr = JSON.stringify(config)
		url.searchParams.set("config", Buffer.from(configStr).toString("base64"))
	}

	// Add profile if provided
	if (profile) {
		url.searchParams.set("profile", profile)
	}

	// Add API key
	url.searchParams.set("api_key", apiKey)

	return url
}
