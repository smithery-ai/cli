import type { ServerDetailResponse } from "@smithery/registry/models/components"

export const httpRemoteServer: ServerDetailResponse = {
	qualifiedName: "author/remote-server",
	remote: true,
	connections: [
		{
			type: "http",
			deploymentUrl: "https://server.smithery.ai",
			configSchema: {},
		},
	],
} as unknown as ServerDetailResponse

export const stdioRegularServer: ServerDetailResponse = {
	qualifiedName: "author/stdio-server",
	remote: false,
	connections: [
		{
			type: "stdio",
			command: "npx",
			args: ["-y", "@author/mcp-server"],
			env: {},
			configSchema: {},
		},
	],
} as unknown as ServerDetailResponse

export const studioBundleServer: ServerDetailResponse = {
	qualifiedName: "author/bundle-server",
	remote: false,
	connections: [
		{
			type: "stdio",
			bundleUrl: "https://smithery.ai/bundles/author/bundle-server.mcpb",
			configSchema: {},
		},
	],
} as unknown as ServerDetailResponse
