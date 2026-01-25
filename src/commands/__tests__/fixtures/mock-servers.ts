import type { ServerGetResponse } from "@smithery/api/resources/servers/servers"

export const httpRemoteServer: ServerGetResponse = {
	qualifiedName: "author/remote-server",
	remote: true,
	connections: [
		{
			type: "http",
			deploymentUrl: "https://server.smithery.ai",
			configSchema: {},
		},
	],
} as unknown as ServerGetResponse

export const stdioRegularServer: ServerGetResponse = {
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
} as unknown as ServerGetResponse

export const studioBundleServer: ServerGetResponse = {
	qualifiedName: "author/bundle-server",
	remote: false,
	connections: [
		{
			type: "stdio",
			bundleUrl: "https://smithery.ai/bundles/author/bundle-server.mcpb",
			configSchema: {},
		},
	],
} as unknown as ServerGetResponse
