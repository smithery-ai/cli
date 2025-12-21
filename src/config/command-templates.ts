/**
 * Command templates for command-based client configurations
 * These functions generate the CLI arguments for installing MCP servers
 */

/**
 * Claude Code STDIO command template
 * Generates: claude mcp add --transport stdio <name> -- <command> [args...]
 * Example: claude mcp add --transport stdio airtable --env AIRTABLE_API_KEY=YOUR_KEY -- npx -y airtable-mcp-server
 */
export function claudeCodeStdioCommand(
	name: string,
	command: string,
	args: string[],
): string[] {
	return ["mcp", "add", "--transport", "stdio", name, "--", command, ...args]
}

/**
 * Claude Code HTTP command template
 * Generates: claude mcp add --transport http <name> <url>
 * Example: claude mcp add --transport http upstash-context-7-mcp "https://server.smithery.ai/@upstash/context7-mcp/mcp"
 */
export function claudeCodeHttpCommand(name: string, url: string): string[] {
	return ["mcp", "add", "--transport", "http", name, url]
}

/**
 * VS Code STDIO command template
 * Generates: code --add-mcp '{"name":"server","command":"npx","args":["@my/server"]}'
 * Example: code --add-mcp '{"name":"airtable","command":"npx","args":["-y","airtable-mcp-server"]}'
 */
export function vscodeStdioCommand(
	name: string,
	command: string,
	args: string[],
): string[] {
	return ["--add-mcp", JSON.stringify({ name, command, args })]
}

/**
 * VS Code HTTP command template
 * Generates: code --add-mcp '{"name":"server","type":"http","url":"https://..."}'
 * Example: code --add-mcp '{"name":"upstash-context","type":"http","url":"https://server.smithery.ai/@upstash/context7-mcp/mcp"}'
 */
export function vscodeHttpCommand(name: string, url: string): string[] {
	return ["--add-mcp", JSON.stringify({ name, type: "http", url })]
}

/**
 * Gemini CLI STDIO command template
 * Generates: gemini mcp add <server-name> <command> <args>
 * Example: gemini mcp add airtable npx -y airtable-mcp-server
 */
export function geminiCliStdioCommand(
	name: string,
	command: string,
	args: string[],
): string[] {
	return ["mcp", "add", name, command, ...args]
}

/**
 * Gemini CLI HTTP command template
 * Generates: gemini mcp add --transport http <server-name> "<url>"
 * Example: gemini mcp add --transport http upstash-context "https://server.smithery.ai/@upstash/context7-mcp/mcp"
 */
export function geminiCliHttpCommand(name: string, url: string): string[] {
	return ["mcp", "add", "--transport", "http", name, url]
}

/**
 * Codex STDIO command template
 * Generates: codex mcp add <server-name> -- <command> [args...]
 * Example: codex mcp add context7 -- npx -y @upstash/context7-mcp
 */
export function codexStdioCommand(
	name: string,
	command: string,
	args: string[],
): string[] {
	return ["mcp", "add", name, "--", command, ...args]
}

/**
 * Codex HTTP command template
 * Generates: codex mcp add <server-name> --url <url>
 * Example: codex mcp add upstash-context --url "https://server.smithery.ai/@upstash/context7-mcp/mcp"
 */
export function codexHttpCommand(name: string, url: string): string[] {
	return ["mcp", "add", name, "--url", url]
}
