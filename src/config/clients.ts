/**
 * Client configuration registry for the CLI
 * Defines which transports each client supports and their configuration format
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

// ============================================================================
// Types
// ============================================================================

/** Command template function signatures */
type StdioCommandTemplate = (
	name: string,
	command: string,
	args: string[],
) => string[]
type HttpCommandTemplate = (name: string, url: string) => string[]

export interface CommandTemplates {
	stdio?: StdioCommandTemplate
	http?: HttpCommandTemplate
}

/** STDIO transport configuration */
export interface StdioTransportConfig {
	/** Type value to write (e.g., "local", "stdio"). Omit field if undefined. */
	typeValue?: string
	/** How command is stored: "string" (default) or "array" (opencode) */
	commandFormat?: "string" | "array"
}

/** HTTP transport configuration */
export interface HttpTransportConfig {
	/** Type value to write (default: "http", cline: "streamableHttp", opencode: "remote") */
	typeValue?: string
	/** Whether client supports OAuth authentication */
	supportsOAuth: boolean
}

/** Format customization for non-standard clients */
export interface FormatConfig {
	/** Top-level key in config file (default: "mcpServers") */
	topLevelKey?: string
	/** Field name mappings */
	fieldMappings?: {
		/** Command field name (default: "command", goose: "cmd") */
		command?: string
		/** Environment field name (default: "env", goose: "envs", opencode: "environment") */
		env?: string
		/** URL field name for HTTP (default: "url", windsurf: "serverUrl") */
		url?: string
	}
}

/** File-based installation config */
export interface FileInstallConfig {
	method: "file"
	format: "json" | "jsonc" | "yaml"
	path: string
}

/** Command-based installation config */
export interface CommandInstallConfig {
	method: "command"
	command: string
	templates: CommandTemplates
}

/** Unified client definition */
export interface ClientDefinition {
	/** Display label for the client */
	label: string

	/** Installation method and config */
	install: FileInstallConfig | CommandInstallConfig

	/** Transport capabilities */
	transports: {
		stdio?: StdioTransportConfig
		http?: HttpTransportConfig
	}

	/** Format customization (only for non-standard clients) */
	format?: FormatConfig
}

// ============================================================================
// Platform-specific paths
// ============================================================================

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

// ============================================================================
// Client Definitions
// ============================================================================

const CLIENTS: Record<string, ClientDefinition> = {
	// -------------------------------------------------------------------------
	// Command-based clients (5)
	// -------------------------------------------------------------------------
	"claude-code": {
		label: "Claude Code",
		install: {
			method: "command",
			command: "claude",
			templates: {
				stdio: claudeCodeStdioCommand,
				http: claudeCodeHttpCommand,
			},
		},
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
	},
	vscode: {
		label: "VS Code",
		install: {
			method: "command",
			command: process.platform === "win32" ? "code.cmd" : "code",
			templates: {
				stdio: vscodeStdioCommand,
				http: vscodeHttpCommand,
			},
		},
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
	},
	"vscode-insiders": {
		label: "VS Code Insiders",
		install: {
			method: "command",
			command:
				process.platform === "win32" ? "code-insiders.cmd" : "code-insiders",
			templates: {
				stdio: vscodeStdioCommand,
				http: vscodeHttpCommand,
			},
		},
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
	},
	"gemini-cli": {
		label: "Gemini CLI",
		install: {
			method: "command",
			command: "gemini",
			templates: {
				stdio: geminiCliStdioCommand,
				http: geminiCliHttpCommand,
			},
		},
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
	},
	codex: {
		label: "Codex",
		install: {
			method: "command",
			command: "codex",
			templates: {
				stdio: codexStdioCommand,
				http: codexHttpCommand,
			},
		},
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
	},

	// -------------------------------------------------------------------------
	// Standard JSON clients (10) - use default mcpServers format
	// -------------------------------------------------------------------------
	cursor: {
		label: "Cursor",
		install: {
			method: "file",
			format: "json",
			path: path.join(homeDir, ".cursor", "mcp.json"),
		},
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
	},
	claude: {
		label: "Claude Desktop",
		install: {
			method: "file",
			format: "json",
			path: defaultClaudePath,
		},
		transports: {
			stdio: {},
		},
	},
	witsy: {
		label: "Witsy",
		install: {
			method: "file",
			format: "json",
			path: path.join(baseDir, "Witsy", "settings.json"),
		},
		transports: {
			stdio: {},
		},
	},
	enconvo: {
		label: "Enconvo",
		install: {
			method: "file",
			format: "json",
			path: path.join(homeDir, ".config", "enconvo", "mcp_config.json"),
		},
		transports: {
			stdio: {},
		},
	},
	roocode: {
		label: "Roo Code",
		install: {
			method: "file",
			format: "json",
			path: path.join(
				baseDir,
				vscodePath,
				"rooveterinaryinc.roo-cline",
				"settings",
				"mcp_settings.json",
			),
		},
		transports: {
			stdio: {},
		},
	},
	boltai: {
		label: "BoltAI",
		install: {
			method: "file",
			format: "json",
			path: path.join(homeDir, ".boltai", "mcp.json"),
		},
		transports: {
			stdio: {},
		},
	},
	"amazon-bedrock": {
		label: "Amazon Bedrock",
		install: {
			method: "file",
			format: "json",
			path: path.join(homeDir, "Amazon Bedrock Client", "mcp_config.json"),
		},
		transports: {
			stdio: {},
		},
	},
	amazonq: {
		label: "Amazon Q",
		install: {
			method: "file",
			format: "json",
			path: path.join(homeDir, ".aws", "amazonq", "mcp.json"),
		},
		transports: {
			stdio: {},
		},
	},
	tome: {
		label: "Tome",
		install: {
			method: "file",
			format: "json",
			path: path.join(homeDir, ".tome", "mcp_config.json"),
		},
		transports: {
			stdio: {},
		},
	},
	librechat: {
		label: "LibreChat",
		install: {
			method: "file",
			format: "yaml",
			path: path.join(
				process.env.LIBRECHAT_CONFIG_DIR || homeDir,
				"LibreChat",
				"librechat.yaml",
			),
		},
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
	},

	// -------------------------------------------------------------------------
	// Simple override clients (2) - single field change
	// -------------------------------------------------------------------------
	windsurf: {
		label: "Windsurf",
		install: {
			method: "file",
			format: "json",
			path: path.join(homeDir, ".codeium", "windsurf", "mcp_config.json"),
		},
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
		format: {
			fieldMappings: { url: "serverUrl" },
		},
	},
	cline: {
		label: "Cline",
		install: {
			method: "file",
			format: "json",
			path: path.join(
				baseDir,
				vscodePath,
				"saoudrizwan.claude-dev",
				"settings",
				"cline_mcp_settings.json",
			),
		},
		transports: {
			stdio: {},
			http: { typeValue: "streamableHttp", supportsOAuth: true },
		},
	},

	// -------------------------------------------------------------------------
	// Complex format clients (2) - structural differences
	// -------------------------------------------------------------------------
	opencode: {
		label: "OpenCode",
		install: {
			method: "file",
			format: "jsonc",
			path: path.join(homeDir, ".opencode", "opencode.jsonc"),
		},
		transports: {
			stdio: { typeValue: "local", commandFormat: "array" },
			http: { typeValue: "remote", supportsOAuth: true },
		},
		format: {
			topLevelKey: "mcp",
			fieldMappings: { env: "environment" },
		},
	},
	goose: {
		label: "Goose",
		install: {
			method: "file",
			format: "yaml",
			path: path.join(homeDir, ".config", "goose", "config.yaml"),
		},
		transports: {
			stdio: { typeValue: "stdio" },
			http: { supportsOAuth: true },
		},
		format: {
			topLevelKey: "extensions",
			fieldMappings: { command: "cmd", env: "envs" },
		},
	},

	// -------------------------------------------------------------------------
	// IDEs and desktop apps with file-based MCP config (added 2026-05)
	// -------------------------------------------------------------------------
	antigravity: {
		label: "Antigravity",
		install: {
			method: "file",
			format: "json",
			// Cross-platform: ~/.gemini/antigravity/mcp_config.json. Used by
			// Google's `agy` editor; same path on every OS. Confirmed via the
			// official MCP install guide and github/github-mcp-server docs.
			path: path.join(homeDir, ".gemini", "antigravity", "mcp_config.json"),
		},
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
		// Antigravity expects `serverUrl` (not `url`) for remote HTTP entries,
		// matching Windsurf's quirk.
		format: {
			fieldMappings: { url: "serverUrl" },
		},
	},
	kiro: {
		label: "Kiro",
		install: {
			method: "file",
			format: "json",
			// User-scope. Workspace `<project>/.kiro/settings/mcp.json` takes
			// precedence when both exist; we always write to user scope so the
			// install survives across projects.
			path: path.join(homeDir, ".kiro", "settings", "mcp.json"),
		},
		transports: {
			stdio: {},
			// Kiro uses the spec-canonical `type: "streamable-http"` (with
			// hyphen) — distinct from cline's `streamableHttp` (camelCase).
			http: { typeValue: "streamable-http", supportsOAuth: true },
		},
	},
	zed: {
		label: "Zed",
		install: {
			method: "file",
			format: "json",
			// `~/.config/zed/settings.json` on macOS/Linux,
			// `%APPDATA%\Zed\settings.json` on Windows.
			path:
				process.platform === "win32"
					? path.join(baseDir, "Zed", "settings.json")
					: path.join(homeDir, ".config", "zed", "settings.json"),
		},
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
		// Zed calls them "context servers", not "MCP servers". The block sits
		// alongside the rest of the user's settings, so we merge non-
		// destructively under that key.
		format: {
			topLevelKey: "context_servers",
		},
	},
	trae: {
		label: "Trae",
		install: {
			method: "file",
			format: "json",
			// Trae is a VS Code fork; user-scope MCP config follows the same
			// `<App Support>/Trae/User/<file>` layout VS Code uses, except the
			// MCP block lives in its own `mcp.json` (per docs.trae.ai).
			path: path.join(baseDir, "Trae", "User", "mcp.json"),
		},
		transports: {
			stdio: {},
			http: { supportsOAuth: true },
		},
	},
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Get client definition by name
 */
export function getClientConfiguration(clientName: string): ClientDefinition {
	const normalizedClientName = clientName.toLowerCase()
	const clientConfig = CLIENTS[normalizedClientName]

	if (!clientConfig) {
		const availableClients = Object.keys(CLIENTS).join(", ")
		throw new Error(
			`Unknown client: ${clientName}. Available clients: ${availableClients}`,
		)
	}

	return clientConfig
}

/**
 * Valid client names - derived from CLIENTS keys
 */
export const VALID_CLIENTS = Object.keys(CLIENTS) as string[]
export type ValidClient = keyof typeof CLIENTS
