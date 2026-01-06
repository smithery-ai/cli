import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export const configSchema = z.object({
	sessionTimeout: z.number().default(3600),
	maxConnections: z.number().default(100),
})

export const stateless = false

export default function ({
	sessionId,
	config,
}: {
	sessionId: string
	config: z.infer<typeof configSchema>
}) {
	const server = new McpServer({
		name: "test-stateful-server",
		version: "1.0.0",
	})

	// Stateful: same instance persists across requests within a session
	let callCount = 0
	const instanceId = Math.random().toString(36).substring(7)
	const sessionData = new Map<string, unknown>()

	server.tool(
		"increment",
		"Test stateful behavior - should increment across calls",
		{},
		async () => {
			callCount++
			sessionData.set("lastCall", Date.now())

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							callCount,
							sessionId,
							instanceId, // Same ID across calls
							message:
								"This increments in stateful mode (same instance per session)",
							sessionTimeout: config.sessionTimeout,
						}),
					},
				],
			}
		},
	)

	server.tool(
		"get_session_data",
		"Get accumulated session data",
		{},
		async () => ({
			content: [
				{
					type: "text",
					text: JSON.stringify({
						sessionId,
						instanceId,
						serverType: "stateful",
						totalCalls: callCount,
						sessionData: Object.fromEntries(sessionData),
						config,
						message: "Same server instance maintains state across requests",
					}),
				},
			],
		}),
	)

	return server.server
}
