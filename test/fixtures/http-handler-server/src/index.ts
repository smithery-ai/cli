import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export const stateful = false

export async function handleHttp(
	request: Request,
	_context: { env: Record<string, string | undefined> },
) {
	const url = new URL(request.url)
	return new Response(
		JSON.stringify({
			path: url.pathname,
			method: request.method,
			handled: true,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	)
}

export default function (_context: { config: unknown }) {
	const server = new McpServer({
		name: "test-http-handler-server",
		version: "1.0.0",
	})

	server.tool("ping", "Simple ping tool", {}, async () => ({
		content: [{ type: "text", text: "pong" }],
	}))

	return server.server
}
