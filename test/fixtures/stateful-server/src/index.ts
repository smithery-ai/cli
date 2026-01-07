import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Session } from "@smithery/sdk"
import { z } from "zod"

export const configSchema = z.object({
	sessionTimeout: z.number().default(3600),
	maxConnections: z.number().default(100),
})

export const stateful = true

export default function ({
	session,
	config,
}: {
	session: Session
	config: z.infer<typeof configSchema>
}) {
	const server = new McpServer({
		name: "test-stateful-server",
		version: "1.0.0",
	})

	server.tool(
		"increment",
		"Test stateful behavior - should increment across calls",
		{},
		async () => {
			const callCount = ((await session.get<number>("callCount")) ?? 0) + 1
			await session.set("callCount", callCount)

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							callCount,
							sessionId: session.id,
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
		async () => {
			const callCount = (await session.get<number>("callCount")) ?? 0
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							sessionId: session.id,
							serverType: "stateful",
							totalCalls: callCount,
							config,
							message: "Same server instance maintains state across requests",
						}),
					},
				],
			}
		},
	)

	return server.server
}
