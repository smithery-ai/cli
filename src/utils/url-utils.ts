/**
 * Configuration type for runners
 */
export type Config = Record<string, unknown>

/**
 * Creates a URL for the Streamable HTTP transport
 * @param baseUrl The base URL to start with
 * @param config Optional configuration object
 * @param apiKey API key (required)
 * @returns A URL object with properly encoded parameters and MCP path prefix
 */
export function createStreamableHTTPTransportUrl(
	baseUrl: string,
	apiKey: string, // api key is required
	config?: Config,
): URL {
	const url = new URL(baseUrl)

	// Add config as base64 encoded parameter
	if (config) {
		const configStr = JSON.stringify(config)
		url.searchParams.set("config", Buffer.from(configStr).toString("base64"))
	}

	// Add API key
	url.searchParams.set("api_key", apiKey)

	return url
}
