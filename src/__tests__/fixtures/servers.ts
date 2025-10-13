/**
 * Test server fixtures for different configuration types
 */

import type { ServerDetailResponse } from "@smithery/registry/models/components"

/**
 * 1. NO CONFIG SERVER
 * Server with no configuration needed at all
 * Example: @smithery-ai/national-weather-service
 */
export const noConfigServer = {
	qualifiedName: "@test/no-config-server",
	displayName: "No Config Server",
	description: "A server that requires no configuration",
	remote: false,
	connections: [
		{
			type: "stdio",
			command: "npx",
			args: ["@test/no-config-server"],
			configSchema: {}, // Empty schema
		},
	],
} as unknown as ServerDetailResponse

/**
 * 2. OPTIONAL ONLY SERVER
 * Server with only optional configuration fields
 * Example: @smithery-ai/fetch (disableSearchWeb with default: false)
 */
export const optionalOnlyServer = {
	qualifiedName: "@test/optional-only-server",
	displayName: "Optional Only Server",
	description: "A server with only optional config fields",
	remote: true,
	connections: [
		{
			type: "http",
			deploymentUrl:
				"https://server.smithery.ai/@test/optional-only-server/mcp",
			configSchema: {
				type: "object",
				properties: {
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
				required: [], // No required fields
			},
		},
	],
} as ServerDetailResponse

/**
 * 3. REQUIRED ONLY SERVER
 * Server with only required configuration fields (no optional beyond required)
 * Example: A simple API key-only server
 */
export const requiredOnlyServer = {
	qualifiedName: "@test/required-only-server",
	displayName: "Required Only Server",
	description: "A server that requires only an API key",
	remote: true,
	connections: [
		{
			type: "http",
			deploymentUrl:
				"https://server.smithery.ai/@test/required-only-server/mcp",
			configSchema: {
				type: "object",
				properties: {
					apiKey: {
						type: "string",
						description: "API key for authentication",
					},
				},
				required: ["apiKey"],
			},
		},
	],
} as ServerDetailResponse

/**
 * 4. REQUIRED + OPTIONAL SERVER
 * Server with both required and optional configuration fields
 * Example: @ref-tools/ref-tools-mcp (required: refApiKey, optional: disableSearchWeb)
 */
export const requiredAndOptionalServer = {
	qualifiedName: "@test/required-and-optional-server",
	displayName: "Required and Optional Server",
	description: "A server with both required and optional config",
	remote: true,
	connections: [
		{
			type: "http",
			deploymentUrl:
				"https://server.smithery.ai/@test/required-and-optional-server/mcp",
			configSchema: {
				type: "object",
				properties: {
					apiKey: {
						type: "string",
						description: "API key for authentication",
					},
					endpoint: {
						type: "string",
						description: "Custom API endpoint",
					},
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
				required: ["apiKey", "endpoint"],
			},
		},
	],
} as ServerDetailResponse
