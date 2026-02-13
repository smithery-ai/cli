const SMITHERY_GATEWAY_BASE = "https://server.smithery.ai/"

/**
 * Normalize an MCP URL. If the input doesn't start with https://,
 * treat it as a Smithery server reference (namespace/serverId) and
 * prepend the Smithery server base URL.
 *
 * Examples:
 *   "anthropic/fetch" → "https://server.smithery.ai/anthropic/fetch"
 *   "https://example.com/mcp" → "https://example.com/mcp"
 */
export function normalizeMcpUrl(url: string): string {
	if (url.startsWith("https://") || url.startsWith("http://")) {
		return url
	}
	return `${SMITHERY_GATEWAY_BASE}${url}`
}
