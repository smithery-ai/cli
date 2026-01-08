import type { ServerRetrieveResponse } from "@smithery/api/resources/servers/servers"

export const httpRemoteServer: ServerRetrieveResponse = {
	qualifiedName: "author/remote-server",
	remote: true,
	connections: [
		{
			type: "http",
			deploymentUrl: "https://server.smithery.ai",
			configSchema: {},
		},
	],
} as unknown as ServerRetrieveResponse

export const stdioRegularServer: ServerRetrieveResponse = {
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
} as unknown as ServerRetrieveResponse

export const studioBundleServer: ServerRetrieveResponse = {
	qualifiedName: "author/bundle-server",
	remote: false,
	connections: [
		{
			type: "stdio",
			bundleUrl: "https://smithery.ai/bundles/author/bundle-server.mcpb",
			configSchema: {},
		},
	],
} as unknown as ServerRetrieveResponse
