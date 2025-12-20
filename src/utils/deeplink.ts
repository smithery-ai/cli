/**
 * Deeplink generation utilities for AI clients
 */

export interface DeeplinkConfig {
	name: string
	type: "http" | "stdio"
	url?: string
	command?: string
	args?: string[]
	headers?: Record<string, string>
}

/**
 * Generate a Cursor deeplink
 * Format: cursor://anysphere.cursor-deeplink/mcp/install?name={name}&config={base64Config}
 */
export function generateCursorDeeplink(config: DeeplinkConfig): {
	url: string
	displayText: string
} {
	const { name, ...configWithoutName } = config
	const base64Config = Buffer.from(JSON.stringify(configWithoutName)).toString(
		"base64",
	)
	const url = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${encodeURIComponent(base64Config)}`
	const displayText = `cursor://anysphere.cursor-deeplink/mcp/install?name=${name}&config=...`

	return { url, displayText }
}

/**
 * Generate a VS Code deeplink
 * Format: vscode:mcp/install?{encodedFullConfig}
 * Note: VS Code uses single colon (not ://) and includes the full config with name field
 */
export function generateVSCodeDeeplink(config: DeeplinkConfig): {
	url: string
	displayText: string
} {
	const url = `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`
	const displayText = `vscode:mcp/install?{"name":"${config.name}","type":"${config.type}",...}`

	return { url, displayText }
}

/**
 * Create a clickable terminal link using OSC 8 escape sequences
 * @param url - The URL to link to
 * @param displayText - The text to display (can be truncated version of URL)
 */
export function createClickableLink(url: string, displayText: string): string {
	return `\x1b]8;;${url}\x1b\\${displayText}\x1b]8;;\x1b\\`
}
