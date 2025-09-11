/**
 * Client configuration registry for the CLI
 * Defines which transports each client supports and their target information
 */

import os from "node:os"
import path from "node:path"

export enum Transport {
	STDIO = "stdio",
	HTTP = "http",
}

export interface ClientConfiguration {
	// Basic info
	label: string

	// Transport capabilities
	supportedTransports: Transport[]

	// Installation method
	installType: "json" | "command" | "yaml" | "toml"

	// File path or command for installation
	path?: string
	command?: string

	// Command-specific configuration for MCP operations
	commandConfig?: {
		// Command templates for different transport types
		stdio?: (name: string, command: string, args: string[]) => string[]
		http?: (name: string, url: string) => string[]
	}

	// Whether this client prefers HTTP over STDIO when both are available
	preferHTTP?: boolean

	// Whether this client supports OAuth authentication (no API key needed in URL)
	supportsOAuth?: boolean
}

// Initialize platform-specific paths
const homeDir = os.homedir()

const platformPaths = {
	win32: {
		baseDir: process.env.APPDATA || path.join(homeDir, "AppData", "Roaming"),
		vscodePath: path.join("Code", "User", "globalStorage"),
	},
	darwin: {
		baseDir: path.join(homeDir, "Library", "Application Support"),
		vscodePath: path.join("Code", "User", "globalStorage"),
	},
	linux: {
		baseDir: process.env.XDG_CONFIG_HOME || path.join(homeDir, ".config"),
		vscodePath: path.join("Code/User/globalStorage"),
	},
}

const platform = process.platform as keyof typeof platformPaths
const { baseDir, vscodePath } = platformPaths[platform]
const defaultClaudePath = path.join(
	baseDir,
	"Claude",
	"claude_desktop_config.json",
)

export const CLIENT_CONFIGURATIONS: Record<string, ClientConfiguration> = {
	claude: {
		label: "Claude Desktop",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: defaultClaudePath,
	},
	"claude-code": {
		label: "Claude Code",
		supportedTransports: [Transport.HTTP, Transport.STDIO],
		installType: "command",
		preferHTTP: true,
		command: "claude",
		supportsOAuth: true,
		commandConfig: {
			stdio: (name: string, command: string, args: string[]) => [
				"mcp",
				"add",
				name,
				"--",
				command,
				...args,
			], // claude mcp add wonderwhy-er-desktop-commander -- npx -y @smithery/cli@latest run @wonderwhy-er/desktop-commander --key xxx
			http: (name: string, url: string) => [
				"mcp",
				"add",
				"--transport",
				"http",
				name,
				url,
			], // claude mcp add --transport http upstash-context-7-mcp "https://server.smithery.ai/@upstash/context7-mcp/mcp"
		},
	},
	cursor: {
		label: "Cursor",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "json",
		preferHTTP: true,
		supportsOAuth: true,
		path: path.join(homeDir, ".cursor", "mcp.json"),
	},
	windsurf: {
		label: "Windsurf",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: path.join(homeDir, ".codeium", "windsurf", "mcp_config.json"),
	},
	cline: {
		label: "Cline",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: path.join(
			baseDir,
			vscodePath,
			"saoudrizwan.claude-dev",
			"settings",
			"cline_mcp_settings.json",
		),
	},
	witsy: {
		label: "Witsy",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: path.join(baseDir, "Witsy", "settings.json"),
	},
	enconvo: {
		label: "Enconvo",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: path.join(homeDir, ".config", "enconvo", "mcp_config.json"),
	},
	vscode: {
		label: "VS Code",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "command",
		preferHTTP: true,
		supportsOAuth: true,
		command: process.platform === "win32" ? "code.cmd" : "code",
		commandConfig: {
			stdio: (name: string, command: string, args: string[]) => [
				"--add-mcp",
				JSON.stringify({ name, command, args }),
			], // code --add-mcp '{"name":"server","command":"npx","args":["@my/server"]}'
			http: (name: string, url: string) => [
				"--add-mcp",
				JSON.stringify({ name, type: "http", url }),
			], // code --add-mcp '{"name":"server","type":"http","url":"https://..."}'
		},
	},
	"vscode-insiders": {
		label: "VS Code Insiders",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "command",
		preferHTTP: true,
		supportsOAuth: true,
		command:
			process.platform === "win32" ? "code-insiders.cmd" : "code-insiders",
		commandConfig: {
			stdio: (name: string, command: string, args: string[]) => [
				"--add-mcp",
				JSON.stringify({ name, command, args }),
			],
			http: (name: string, url: string) => [
				"--add-mcp",
				JSON.stringify({ name, type: "http", url }),
			],
		},
	},
	roocode: {
		label: "Roo Code",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: path.join(
			baseDir,
			vscodePath,
			"rooveterinaryinc.roo-cline",
			"settings",
			"mcp_settings.json",
		),
	},
	boltai: {
		label: "BoltAI",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: path.join(homeDir, ".boltai", "mcp.json"),
	},
	"amazon-bedrock": {
		label: "Amazon Bedrock",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: path.join(homeDir, "Amazon Bedrock Client", "mcp_config.json"),
	},
	amazonq: {
		label: "Amazon Q",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: path.join(homeDir, ".aws", "amazonq", "mcp.json"),
	},
	raycast: {
		label: "Raycast",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		// Note: Raycast might use deep links instead of file config
		path: path.join(homeDir, ".raycast", "mcp_config.json"),
	},
	tome: {
		label: "Tome",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		// Note: Tome might use deep links instead of file config
		path: path.join(homeDir, ".tome", "mcp_config.json"),
	},
	librechat: {
		label: "LibreChat",
		supportedTransports: [Transport.STDIO],
		installType: "yaml",
		path: path.join(
			process.env.LIBRECHAT_CONFIG_DIR || homeDir,
			"LibreChat",
			"librechat.yaml",
		),
	},
	"gemini-cli": {
		label: "Gemini CLI",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: path.join(homeDir, ".gemini", "settings.json"),
	},
	codex: {
		label: "Codex",
		supportedTransports: [Transport.STDIO],
		installType: "toml",
		path: path.join(homeDir, ".codex", "config.toml"),
	},
}

/**
 * Get client configuration by name
 */
export function getClientConfiguration(
	clientName: string,
): ClientConfiguration {
	const normalizedClientName = clientName.toLowerCase()
	const clientConfig = CLIENT_CONFIGURATIONS[normalizedClientName]

	if (!clientConfig) {
		const availableClients = Object.keys(CLIENT_CONFIGURATIONS).join(", ")
		throw new Error(
			`Unknown client: ${clientName}. Available clients: ${availableClients}`,
		)
	}

	return clientConfig
}

/**
 * Check if a client supports a specific transport
 */
export function clientSupportsTransport(
	clientName: string,
	transport: Transport,
): boolean {
	const config = getClientConfiguration(clientName)
	return config.supportedTransports.includes(transport)
}

/**
 * Get the preferred transport for a client when multiple are available
 */
export function getPreferredTransport(
	clientName: string,
	availableTransports: Transport[],
): Transport | null {
	const config = getClientConfiguration(clientName)

	// Filter to only transports the client supports
	const supportedAvailable = availableTransports.filter((transport) =>
		config.supportedTransports.includes(transport),
	)

	if (supportedAvailable.length === 0) return null
	if (supportedAvailable.length === 1) return supportedAvailable[0]

	// If client prefers HTTP and it's available, use it
	if (config.preferHTTP && supportedAvailable.includes(Transport.HTTP)) {
		return Transport.HTTP
	}

	// Otherwise prefer STDIO if available (more reliable)
	if (supportedAvailable.includes(Transport.STDIO)) {
		return Transport.STDIO
	}

	// Fallback to first available
	return supportedAvailable[0]
}

/**
 * Check if a client is HTTP-only (supports HTTP but not STDIO)
 */
export function isHttpOnlyClient(clientName: string): boolean {
	const config = getClientConfiguration(clientName)

	return (
		config.supportedTransports.includes(Transport.HTTP) &&
		!config.supportedTransports.includes(Transport.STDIO)
	)
}

/**
 * Valid client names - derived from CLIENT_CONFIGURATIONS keys
 */
export const VALID_CLIENTS = Object.keys(CLIENT_CONFIGURATIONS) as string[]
export type ValidClient = keyof typeof CLIENT_CONFIGURATIONS

/**
 * Check if a client name is valid
 */
export function isValidClient(clientName: string): clientName is ValidClient {
	return VALID_CLIENTS.includes(clientName as ValidClient)
}
