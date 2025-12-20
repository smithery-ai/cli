/**
 * Configuration fixtures for testing validation and prompting flows
 *
 * IMPORTANT: MCP Config Standardization
 *
 * All client config files (JSON, YAML, TOML) use different formats and naming conventions,
 * but internally the codebase uses MCP config as the standardized currency:
 *
 * - First mile (readConfig): Client file formats (JSON/YAML/TOML with mcp_servers or mcpServers)
 *   → normalized ClientMCPConfig with mcpServers property
 *
 * - Internal processing: All operations use ClientMCPConfig with mcpServers structure
 *   → installServer reads config, merges server, writes config (server-type agnostic)
 *
 * - Last mile (writeConfig): Normalized ClientMCPConfig with mcpServers
 *   → client-specific file format (JSON/YAML/TOML with appropriate naming)
 *
 * Therefore, fixtures represent the normalized internal format (what readConfig returns),
 * not the raw client file formats. Server-type specifics (HTTP vs STDIO, command vs bundle)
 * are handled by sub-functions like formatServerConfig and should be tested separately.
 */

import type { ServerConfig, ValidationResponse } from "../../types/registry"
import type { ClientMCPConfig } from "../../utils/mcp-config"

/**
 * VALIDATION RESPONSE FIXTURES
 * Mock responses from validateUserConfig API
 */

export const validationResponses: Record<string, ValidationResponse> = {
	// No config needed
	noConfig: {
		isComplete: true,
		hasExistingConfig: false,
		missingFields: [],
		fieldSchemas: {},
	},

	// Optional only - no saved config
	optionalOnlyFresh: {
		isComplete: true, // No required fields missing
		hasExistingConfig: false,
		missingFields: [],
		fieldSchemas: {
			debugMode: {
				type: "boolean",
				description: "Enable debug logging",
				default: false,
			},
			timeout: {
				type: "number",
				description: "Request timeout in seconds",
				default: 30,
			},
		},
	},

	// Optional only - has saved config
	optionalOnlyComplete: {
		isComplete: true,
		hasExistingConfig: true,
		missingFields: [],
		fieldSchemas: {
			debugMode: {
				type: "boolean",
				description: "Enable debug logging",
				default: false,
			},
			timeout: {
				type: "number",
				description: "Request timeout in seconds",
				default: 30,
			},
		},
	},

	// Required only - no saved config
	requiredOnlyFresh: {
		isComplete: false,
		hasExistingConfig: false,
		missingFields: ["apiKey"],
		fieldSchemas: {
			apiKey: { type: "string", description: "API key for authentication" },
		},
	},

	// Required only - partial saved config (shouldn't happen but good to test)
	requiredOnlyPartial: {
		isComplete: false,
		hasExistingConfig: true,
		missingFields: ["apiKey"],
		fieldSchemas: {
			apiKey: { type: "string", description: "API key for authentication" },
		},
	},

	// Required only - complete saved config
	requiredOnlyComplete: {
		isComplete: true,
		hasExistingConfig: true,
		missingFields: [],
		fieldSchemas: {
			apiKey: { type: "string", description: "API key for authentication" },
		},
	},

	// Required + Optional - no saved config
	requiredAndOptionalFresh: {
		isComplete: false,
		hasExistingConfig: false,
		missingFields: ["apiKey", "endpoint"],
		fieldSchemas: {
			apiKey: { type: "string", description: "API key for authentication" },
			endpoint: { type: "string", description: "Custom API endpoint" },
			debugMode: {
				type: "boolean",
				description: "Enable debug logging",
				default: false,
			},
			maxRetries: {
				type: "number",
				description: "Maximum number of retries",
				default: 3,
			},
		},
	},

	// Required + Optional - partial saved config (missing some required)
	requiredAndOptionalPartial: {
		isComplete: false,
		hasExistingConfig: true,
		missingFields: ["endpoint"], // Has apiKey but missing endpoint
		fieldSchemas: {
			apiKey: { type: "string", description: "API key for authentication" },
			endpoint: { type: "string", description: "Custom API endpoint" },
			debugMode: {
				type: "boolean",
				description: "Enable debug logging",
				default: false,
			},
			maxRetries: {
				type: "number",
				description: "Maximum number of retries",
				default: 3,
			},
		},
	},

	// Required + Optional - complete saved config
	requiredAndOptionalComplete: {
		isComplete: true,
		hasExistingConfig: true,
		missingFields: [],
		fieldSchemas: {
			apiKey: { type: "string", description: "API key for authentication" },
			endpoint: { type: "string", description: "Custom API endpoint" },
			debugMode: {
				type: "boolean",
				description: "Enable debug logging",
				default: false,
			},
			maxRetries: {
				type: "number",
				description: "Maximum number of retries",
				default: 3,
			},
		},
	},
}

/**
 * SAVED CONFIG FIXTURES
 * Mock responses from getUserConfig (what's already saved in registry)
 */

export const savedConfigs: Record<string, ServerConfig | null> = {
	// No saved config (fresh install)
	none: null,

	// Optional only - complete
	optionalOnly: {
		debugMode: true,
		timeout: 60,
	},

	// Required only - complete
	requiredOnly: {
		apiKey: "saved-api-key-456",
	},

	// Required only - partial (edge case, shouldn't normally happen)
	requiredOnlyPartial: {},

	// Required + Optional - complete
	requiredAndOptional: {
		apiKey: "saved-api-key-456",
		endpoint: "https://saved.example.com",
		debugMode: false,
		maxRetries: 3,
	},

	// Required + Optional - partial (has some required, missing others)
	requiredAndOptionalPartial: {
		apiKey: "saved-api-key-456",
		// Missing: endpoint
	},
}

/**
 * COLLECTED CONFIG FIXTURES
 * Mock responses from collectConfigValues (what user entered)
 */

export const collectedConfigs: Record<string, ServerConfig> = {
	empty: {},

	optionalOnly: {
		debugMode: true,
		timeout: 60,
	},

	requiredOnly: {
		apiKey: "test-api-key-123",
	},

	requiredAndOptional: {
		apiKey: "test-api-key-123",
		endpoint: "https://api.example.com",
		debugMode: true,
		maxRetries: 5,
	},

	requiredAndOptionalNoOptional: {
		apiKey: "test-api-key-123",
		endpoint: "https://api.example.com",
		// User declined optional fields
	},

	// Just the missing required fields (for partial config scenarios)
	missingEndpoint: {
		endpoint: "https://api.example.com",
	},
}

/**
 * INITIAL CONFIG FIXTURES
 * Mock responses from readConfig (what's in the client config file initially)
 * These represent the state of the config file BEFORE installation.
 * All fixtures use the normalized MCP config format (mcpServers structure).
 */

export const initialConfigs: Record<string, ClientMCPConfig> = {
	// Empty config - no servers installed yet
	empty: {
		mcpServers: {},
	},

	// Config with one STDIO server
	withOneStdioServer: {
		mcpServers: {
			"existing-stdio": {
				command: "npx",
				args: ["-y", "@smithery/cli@latest", "run", "existing-stdio"],
			},
		},
	},

	// Config with one HTTP server
	withOneHttpServer: {
		mcpServers: {
			"existing-http": {
				type: "http",
				url: "https://server.smithery.ai/existing-http/mcp",
				headers: {},
			},
		},
	},

	// Config with multiple servers (mixed types)
	withMultipleServers: {
		mcpServers: {
			"server-one": {
				command: "npx",
				args: ["-y", "@smithery/cli@latest", "run", "server-one"],
			},
			"server-two": {
				type: "http",
				url: "https://server.smithery.ai/server-two/mcp",
				headers: {},
			},
			"server-three": {
				command: "python",
				args: ["-m", "mcp_server"],
			},
		},
	},

	// Config with a server that will conflict (same name as what we're installing)
	withConflictingServer: {
		mcpServers: {
			"test-server": {
				command: "npx",
				args: ["-y", "@smithery/cli@latest", "run", "old-test-server"],
			},
		},
	},
}
