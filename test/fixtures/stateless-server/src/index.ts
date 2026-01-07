import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export const configSchema = z.object({
	apiKey: z.string().optional(),
	timeout: z.number().optional(),
	nested: z
		.object({
			value: z.string().optional(),
		})
		.optional(),
})

export const stateful = false

export default function ({ config }: { config: z.infer<typeof configSchema> }) {
	const server = new McpServer({
		name: "test-stateless-server",
		version: "1.0.0",
	})

	// Stateless: each request gets fresh instance, no memory between calls
	let callCount = 0

	server.tool(
		"increment",
		"Test stateless behavior - should always return 1",
		{},
		async () => {
			callCount++
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							callCount,
							message:
								"This should always be 1 in stateless mode (fresh instance per request)",
							apiKey: config.apiKey ? "configured" : "missing",
						}),
					},
				],
			}
		},
	)

	server.tool("get_server_info", "Get server type info", {}, async () => ({
		content: [
			{
				type: "text",
				text: JSON.stringify({
					serverType: "stateless",
					instanceId: Math.random().toString(36).substring(7), // New ID per instance
					message: "Each request creates a new server instance",
				}),
			},
		],
	}))

	server.tool(
		"get_config",
		"Returns the config passed to the server",
		{},
		async () => ({
			content: [
				{
					type: "text",
					text: JSON.stringify(config),
				},
			],
		}),
	)

	return server.server
}
