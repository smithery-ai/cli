/**
 * Configuration type for runners
 */
export type Config = Record<string, unknown>

/**
 * Creates a URL for the Streamable HTTP transport
 * @param baseUrl The base URL to start with
 * @param config Optional configuration object
 * @param apiKey Optional API key
 * @returns A URL object with properly encoded parameters and MCP path prefix
 */
export function createShttpTransportUrl(
	baseUrl: string,
	config?: Config,
	apiKey?: string,
): URL {
	// Ensure baseUrl ends with /mcp
	const url = new URL(baseUrl)
	if (!url.pathname.endsWith("/mcp")) {
		url.pathname = url.pathname.endsWith("/") 
			? `${url.pathname}mcp` 
			: `${url.pathname}/mcp`
	}
	
	// Add config as base64 encoded parameter
	if (config) {
		const configStr = JSON.stringify(config)
		url.searchParams.set("config", Buffer.from(configStr).toString("base64"))
	}
	
	// Add API key with correct parameter name
	if (apiKey) {
		url.searchParams.set("api_key", apiKey)
	}
	
	return url
} 