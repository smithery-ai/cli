import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export const stateful = false

export function createAuthAdapter({
	env: _env,
}: {
	env: Record<string, string | undefined>
}) {
	return {
		async getAuthorizationUrl(args: {
			callbackUrl: string
			state: string
			codeChallenge?: string
			config: unknown
		}) {
			return {
				authorizationUrl: `https://example.com/auth?state=${args.state}&callback=${encodeURIComponent(args.callbackUrl)}`,
			}
		},

		async exchangeCode(args: {
			code: string
			callbackUrl: string
			codeVerifier?: string
			config: unknown
		}) {
			return {
				accessToken: `test-access-token-${args.code}`,
				refreshToken: "test-refresh-token",
				expiresIn: 3600,
			}
		},

		async refreshToken(_args: { refreshToken: string; config: unknown }) {
			return {
				accessToken: "test-refreshed-access-token",
				refreshToken: "test-new-refresh-token",
				expiresIn: 3600,
			}
		},
	}
}

export default function (_context: { config: unknown }) {
	const server = new McpServer({
		name: "test-auth-server",
		version: "1.0.0",
	})

	server.tool("ping", "Simple ping tool", {}, async () => ({
		content: [{ type: "text", text: "pong" }],
	}))

	return server.server
}
