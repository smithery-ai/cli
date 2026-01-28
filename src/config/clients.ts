/**
 * Client configuration registry for the CLI
 * Defines which transports each client supports and their target information
 */

import os from "node:os"
import path from "node:path"
import {
	claudeCodeHttpCommand,
	claudeCodeStdioCommand,
	codexHttpCommand,
	codexStdioCommand,
	geminiCliHttpCommand,
	geminiCliStdioCommand,
	vscodeHttpCommand,
	vscodeStdioCommand,
} from "./command-templates.js"

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
	installType: "json" | "command" | "yaml" | "jsonc"

	// File path or command for installation
	path?: string
	command?: string

	// Command-specific configuration for MCP operations
	commandConfig?: {
		// Command templates for different transport types
		stdio?: (name: string, command: string, args: string[]) => string[]
		http?: (name: string, url: string) => string[]
	}

	// Whether this client supports OAuth authentication (no API key needed in URL)
	supportsOAuth?: boolean

	// Optional override for HTTP URL key name (defaults to "url")
	// Some clients require different key names like "serverUrl"
	httpUrlKey?: string

	// Optional override for HTTP type value (defaults to "http")
	// Some clients require different type values like "streamableHttp"
	httpType?: string
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
	"claude-code": {
		label: "Claude Code",
		supportedTransports: [Transport.HTTP, Transport.STDIO],
		installType: "command",
		command: "claude",
		supportsOAuth: true,
		commandConfig: {
			stdio: claudeCodeStdioCommand,
			http: claudeCodeHttpCommand,
		},
	},
	cursor: {
		label: "Cursor",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "json",
		supportsOAuth: true,
		path: path.join(homeDir, ".cursor", "mcp.json"),
	},
	windsurf: {
		label: "Windsurf",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "json",
		supportsOAuth: true,
		// Legacy field kept for backward compatibility
		httpUrlKey: "serverUrl",
		path: path.join(homeDir, ".codeium", "windsurf", "mcp_config.json"),
	},
	cline: {
		label: "Cline",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "json",
		supportsOAuth: true,
		// Legacy field kept for backward compatibility
		httpType: "streamableHttp",
		path: path.join(
			baseDir,
			vscodePath,
			"saoudrizwan.claude-dev",
			"settings",
			"cline_mcp_settings.json",
		),
	},
	vscode: {
		label: "VS Code",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "command",
		supportsOAuth: true,
		command: process.platform === "win32" ? "code.cmd" : "code",
		commandConfig: {
			stdio: vscodeStdioCommand,
			http: vscodeHttpCommand,
		},
	},
	"vscode-insiders": {
		label: "VS Code Insiders",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "command",
		supportsOAuth: true,
		command:
			process.platform === "win32" ? "code-insiders.cmd" : "code-insiders",
		commandConfig: {
			stdio: vscodeStdioCommand,
			http: vscodeHttpCommand,
		},
	},
	librechat: {
		label: "LibreChat",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "yaml",
		supportsOAuth: true,
		path: path.join(
			process.env.LIBRECHAT_CONFIG_DIR || homeDir,
			"LibreChat",
			"librechat.yaml",
		),
	},
	"gemini-cli": {
		label: "Gemini CLI",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "command",
		command: "gemini",
		supportsOAuth: true,
		commandConfig: {
			stdio: geminiCliStdioCommand,
			http: geminiCliHttpCommand,
		},
	},
	codex: {
		label: "Codex",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "command",
		command: "codex",
		supportsOAuth: true,
		commandConfig: {
			stdio: codexStdioCommand,
			http: codexHttpCommand,
		},
	},
	opencode: {
		label: "OpenCode",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "jsonc",
		supportsOAuth: true,
		path: path.join(homeDir, ".opencode", "opencode.jsonc"),
	},
	claude: {
		label: "Claude Desktop",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		path: defaultClaudePath,
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
	tome: {
		label: "Tome",
		supportedTransports: [Transport.STDIO],
		installType: "json",
		// Note: Tome might use deep links instead of file config
		path: path.join(homeDir, ".tome", "mcp_config.json"),
	},
	goose: {
		label: "Goose",
		supportedTransports: [Transport.STDIO, Transport.HTTP],
		installType: "yaml",
		path: path.join(homeDir, ".config", "goose", "config.yaml"),
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
 * Valid client names - derived from CLIENT_CONFIGURATIONS keys
 */
export const VALID_CLIENTS = Object.keys(CLIENT_CONFIGURATIONS) as string[]
export type ValidClient = keyof typeof CLIENT_CONFIGURATIONS
