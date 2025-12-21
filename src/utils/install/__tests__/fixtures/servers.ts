import type { ServerDetailResponse } from "@smithery/registry/models/components"

export const noConfigServer: ServerDetailResponse = {
	qualifiedName: "@test/no-config-server",
	remote: false,
	connections: [
		{
			type: "stdio",
			configSchema: {},
		},
	],
} as unknown as ServerDetailResponse

export const optionalOnlyServer: ServerDetailResponse = {
	qualifiedName: "@test/optional-only-server",
	remote: true,
	deploymentUrl: "https://server.smithery.ai",
	connections: [
		{
			type: "http",
			deploymentUrl: "https://server.smithery.ai",
			configSchema: {
				type: "object",
				properties: {
					debugMode: {
						type: "boolean",
						default: false,
					},
					maxRetries: {
						type: "number",
						default: 3,
					},
				},
			},
		},
	],
} as unknown as ServerDetailResponse

export const requiredOnlyServer: ServerDetailResponse = {
	qualifiedName: "@test/required-only-server",
	remote: true,
	deploymentUrl: "https://server.smithery.ai",
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
} as unknown as ServerDetailResponse

export const requiredAndOptionalServer: ServerDetailResponse = {
	qualifiedName: "@test/required-and-optional-server",
	remote: false,
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
} as unknown as ServerDetailResponse
