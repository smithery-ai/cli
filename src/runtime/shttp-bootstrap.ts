// @ts-expect-error - virtual:user-module is a placeholder replaced at upload time
import * as _userModule from "virtual:user-module"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import type {
	ServerModule,
	Session,
	StatelessServerContext,
} from "@smithery/sdk"

const userModule = _userModule as ServerModule
const createServer = userModule.default
const stateful = userModule.stateful ?? false
const createAuthAdapter = userModule.createAuthAdapter
const handleHttp = userModule.handleHttp

interface McpSessionStub {
	fetch(request: Request): Promise<Response>
	rpc(message: unknown): Promise<void>
}

interface McpSessionId {
	toString(): string
}

interface McpSessionNamespace {
	idFromString(id: string): McpSessionId
	newUniqueId(): McpSessionId
	get(id: McpSessionId): McpSessionStub
}

/**
 * Set a nested value in an object using dot-notation path parts.
 * e.g., setNested(obj, ["a", "b", "c"], value) → obj.a.b.c = value
 */
function setNested(
	obj: Record<string, unknown>,
	pathParts: string[],
	value: unknown,
) {
	let current = obj
	for (let i = 0; i < pathParts.length - 1; i++) {
		const part = pathParts[i]
		if (!(part in current) || typeof current[part] !== "object") {
			current[part] = {}
		}
		current = current[part] as Record<string, unknown>
	}
	current[pathParts[pathParts.length - 1]] = value
}

/**
 * Extract config from URL query parameters using dot-notation.
 * e.g., ?apiKey=abc&db.host=localhost → { apiKey: "abc", db: { host: "localhost" } }
 */
function extractConfigFromUrl(url: URL): Record<string, unknown> {
	const config: Record<string, unknown> = {}

	url.searchParams.forEach((value, key) => {
		const pathParts = key.split(".")

		// Try to parse value as JSON (for booleans, numbers, objects)
		let parsedValue: unknown = value
		try {
			parsedValue = JSON.parse(value)
		} catch {
			// If parsing fails, use the raw string value
		}

		setNested(config, pathParts, parsedValue)
	})

	return config
}

// Stateful session handler - in-memory state (no persistence needed for dev)
export class McpSession {
	private ctx: { id: McpSessionId }
	private env: Record<string, string | undefined>
	private server: Awaited<ReturnType<typeof createServer>> | null = null
	private transport: WebStandardStreamableHTTPServerTransport | null = null
	private sessionData = new Map<string, unknown>()
	private initialized = false

	constructor(
		ctx: { id: McpSessionId },
		env: Record<string, string | undefined>,
	) {
		this.ctx = ctx
		this.env = env
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url)
		const config = extractConfigFromUrl(url)

		if (!this.server) {
			const session: Session = {
				id: this.ctx.id.toString(),
				get: async <T = unknown>(key: string) =>
					this.sessionData.get(key) as T | undefined,
				set: async (key, value) => {
					this.sessionData.set(key, value)
				},
				delete: async (key) => {
					this.sessionData.delete(key)
				},
			}
			this.server = await createServer({ config, session, env: this.env })
			this.transport = new WebStandardStreamableHTTPServerTransport({
				sessionIdGenerator: () => this.ctx.id.toString(),
			})
			await this.server.connect(this.transport)
		} else if (this.initialized && this.transport) {
			// @ts-expect-error restore transport state for reconnection
			this.transport._initialized = true
			this.transport.sessionId = this.ctx.id.toString()
		}

		const response = await this.transport!.handleRequest(request)
		if (!this.initialized) this.initialized = true
		return response
	}

	async rpc(message: unknown): Promise<void> {
		if (!this.transport) return
		const request = new Request("http://internal/rpc", {
			method: "POST",
			body: JSON.stringify(message),
			headers: {
				"Content-Type": "application/json",
				"Mcp-Session-Id": this.ctx.id.toString(),
			},
		})
		await this.transport.handleRequest(request)
	}
}

// Stateless handler - new server/transport per request, no session
async function handleStateless(
	request: Request,
	env: Record<string, string | undefined>,
) {
	if (request.method === "GET") {
		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				error: { code: -32000, message: "GET not supported in stateless mode" },
				id: null,
			}),
			{
				status: 405,
				headers: { "Content-Type": "application/json", Allow: "POST, DELETE" },
			},
		)
	}

	const url = new URL(request.url)
	const config = extractConfigFromUrl(url)
	const context: StatelessServerContext = { config, env }
	const server = await createServer(context)
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	})
	await server.connect(transport)
	return transport.handleRequest(request)
}

// Stateful handler - route to session
async function handleStateful(
	request: Request,
	env: {
		MCP_SESSION: McpSessionNamespace
	},
) {
	const sessionId = request.headers.get("mcp-session-id")
	const id = sessionId
		? env.MCP_SESSION.idFromString(sessionId)
		: env.MCP_SESSION.newUniqueId()
	return env.MCP_SESSION.get(id).fetch(request)
}

const AUTH_PATH = "/__smithery/auth"

function isAuthRequest(request: Request) {
	return (
		request.method === "POST" && new URL(request.url).pathname === AUTH_PATH
	)
}

function jsonResponse(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	})
}

async function handleAuthRequest(
	request: Request,
	adapter: Awaited<ReturnType<NonNullable<typeof createAuthAdapter>>>,
) {
	try {
		const body = (await request.json()) as {
			action: string
			payload: Record<string, unknown>
		}

		switch (body.action) {
			case "getAuthorizationUrl":
				return jsonResponse({
					ok: true,
					value: await adapter.getAuthorizationUrl(
						body.payload as Parameters<typeof adapter.getAuthorizationUrl>[0],
					),
				})
			case "exchangeCode":
				return jsonResponse({
					ok: true,
					value: await adapter.exchangeCode(
						body.payload as Parameters<typeof adapter.exchangeCode>[0],
					),
				})
			case "refreshToken":
				return jsonResponse({
					ok: true,
					value: await adapter.refreshToken(
						body.payload as Parameters<typeof adapter.refreshToken>[0],
					),
				})
			default:
				return jsonResponse(
					{
						ok: false,
						error: "unknown_action",
						message: `Unknown action: ${body.action}`,
					},
					400,
				)
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error"
		return jsonResponse({ ok: false, error: "adapter_error", message }, 500)
	}
}

async function loggedFetch(request: Request, env: Record<string, unknown>) {
	const url = new URL(request.url)
	const sessionId = request.headers.get("mcp-session-id")
	console.log(
		`[MCP] ${request.method} ${url.pathname}${sessionId ? ` (session: ${sessionId.slice(0, 8)}...)` : ""}`,
	)

	const startTime = Date.now()
	const resolvedEnv = env as Record<string, string | undefined>

	let response: Response

	// 1. Auth requests
	if (createAuthAdapter && isAuthRequest(request)) {
		try {
			const adapter = await createAuthAdapter({ env: resolvedEnv })
			response = await handleAuthRequest(request, adapter)
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			response = jsonResponse(
				{ ok: false, error: "adapter_init_failed", message },
				500,
			)
		}
	}
	// 2. HTTP handler for non-root paths
	else if (handleHttp && url.pathname !== "/" && url.pathname !== AUTH_PATH) {
		if (stateful) {
			const mcpSessionNs = env as unknown as {
				MCP_SESSION: McpSessionNamespace
			}
			response = await handleHttp(request, {
				env: resolvedEnv,
				sessions: {
					async send(targetSessionId: string, message: unknown) {
						const doId = mcpSessionNs.MCP_SESSION.idFromString(targetSessionId)
						const stub = mcpSessionNs.MCP_SESSION.get(doId)
						await stub.rpc(message)
					},
				},
			})
		} else {
			response = await handleHttp(request, { env: resolvedEnv })
		}
	}
	// 3. Default: MCP protocol handling
	else {
		response = stateful
			? await handleStateful(
					request,
					env as unknown as { MCP_SESSION: McpSessionNamespace },
				)
			: await handleStateless(request, resolvedEnv)
	}

	const duration = Date.now() - startTime
	console.log(`[MCP] ${response.status} (${duration}ms)`)
	return response
}

export default { fetch: loggedFetch }
