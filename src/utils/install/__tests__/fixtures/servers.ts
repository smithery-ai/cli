import type { ServerGetResponse } from "@smithery/api/resources/servers/servers"

type Server = ServerGetResponse

export const noConfigServer: Server = {
	qualifiedName: "@test/no-config-server",
	displayName: "No Config Server",
	description: "A test server with no config",
	iconUrl: null,
	remote: false,
	deploymentUrl: null,
	security: null,
	tools: null,
	connections: [
		{
			type: "stdio",
			configSchema: {},
		},
	],
}

export const requiredOnlyServer: Server = {
	qualifiedName: "@test/required-only-server",
	displayName: "Required Only Server",
	description: "A test server with required only config",
	iconUrl: null,
	remote: true,
	deploymentUrl: "https://server.smithery.ai",
	security: null,
	tools: null,
	connections: [
		{
			type: "http",
			deploymentUrl: "https://server.smithery.ai",
			configSchema: {
				type: "object",
				properties: {
					apiKey: {
						type: "string",
					},
					endpoint: {
						type: "string",
					},
				},
				required: ["apiKey", "endpoint"],
			},
		},
	],
}

export const requiredAndOptionalServer: Server = {
	qualifiedName: "@test/required-and-optional-server",
	displayName: "Required and Optional Server",
	description: "A test server with both required and optional config",
	iconUrl: null,
	remote: false,
	deploymentUrl: null,
	security: null,
	tools: null,
	connections: [
		{
			type: "stdio",
			configSchema: {
				type: "object",
				properties: {
					apiKey: {
						type: "string",
					},
					endpoint: {
						type: "string",
					},
					debugMode: {
						type: "boolean",
						default: false,
					},
					maxRetries: {
						type: "number",
						default: 3,
					},
				},
				required: ["apiKey", "endpoint"],
			},
		},
	],
}
