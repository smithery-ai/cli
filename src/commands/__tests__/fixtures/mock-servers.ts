import type { Server } from "@smithery/registry/models/components"

export const httpRemoteServer: Server = {
	qualifiedName: "author/remote-server",
	remote: true,
	connections: [
		{
			type: "http",
			deploymentUrl: "https://server.smithery.ai",
			configSchema: {},
		},
	],
} as unknown as Server

export const stdioRegularServer: Server = {
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
} as unknown as Server

export const studioBundleServer: Server = {
	qualifiedName: "author/bundle-server",
	remote: false,
	connections: [
		{
			type: "stdio",
			bundleUrl: "https://smithery.ai/bundles/author/bundle-server.mcpb",
			configSchema: {},
		},
	],
} as unknown as Server
