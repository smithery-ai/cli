/**
 * Configuration fixtures for testing validation and prompting flows
 */

import type { ServerConfig, ValidationResponse } from "../../types/registry"

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
