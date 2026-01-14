import { existsSync, mkdirSync, rmSync } from "node:fs"
import net from "node:net"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import * as esbuild from "esbuild"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { buildServer } from "../build"
import { createDevServer } from "../dev-server"

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_ROOT = resolve(__dirname, "../../../")
const FIXTURES = resolve(CLI_ROOT, "test/fixtures")
const OUT_DIR = resolve(CLI_ROOT, ".smithery-e2e")

/**
 * Helper to parse MCP response which might be wrapped in SSE format
 */
function parseMcpResponse(text: string) {
	if (text.startsWith("event: message")) {
		const match = text.match(/data: (\{.*\})/m)
		if (match) {
			return JSON.parse(match[1])
		}
	}
	return JSON.parse(text)
}

async function mcpRequest(
	url: string,
	method: string,
	params: Record<string, unknown>,
	sessionId?: string,
) {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Accept: "application/json, text/event-stream",
	}
	if (sessionId) {
		headers["mcp-session-id"] = sessionId
	}

	const res = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: Math.floor(Math.random() * 1000),
			method,
			params,
		}),
	})

	const text = await res.text()
	if (!res.ok) {
		throw new Error(`MCP Request failed (${res.status}): ${text}`)
	}

	return {
		json: parseMcpResponse(text),
		sessionId: res.headers.get("mcp-session-id"),
	}
}

async function canListenOnLocalhost(): Promise<boolean> {
	return await new Promise((resolve) => {
		const server = net.createServer()
		server.once("error", () => resolve(false))
		server.listen(0, "127.0.0.1", () => {
			server.close(() => resolve(true))
		})
	})
}

// Some sandboxed environments (like CI sandboxes) disallow binding sockets.
// Skip these E2E tests in that case.
const describeE2E = (await canListenOnLocalhost()) ? describe : describe.skip

describeE2E("CLI E2E MCP Server", { timeout: 60000 }, () => {
	beforeAll(async () => {
		if (existsSync(OUT_DIR)) {
			rmSync(OUT_DIR, { recursive: true, force: true })
		}
		mkdirSync(OUT_DIR, { recursive: true })

		// Bundle the bootstraps for testing
		const shttp = await esbuild.build({
			entryPoints: [resolve(CLI_ROOT, "src/runtime/shttp-bootstrap.ts")],
			bundle: true,
			format: "esm",
			platform: "browser",
			target: "es2022",
			write: false,
			minify: false,
			external: ["virtual:user-module"],
		})

		const stdio = await esbuild.build({
			entryPoints: [resolve(CLI_ROOT, "src/runtime/stdio-bootstrap.ts")],
			bundle: true,
			format: "esm",
			platform: "node",
			target: "node20",
			write: false,
			minify: false,
			external: ["virtual:user-module"],
		})

		// @ts-expect-error global injection for tests
		globalThis.__SHTTP_BOOTSTRAP__ = shttp.outputFiles[0].text
		// @ts-expect-error global injection for tests
		globalThis.__STDIO_BOOTSTRAP__ = stdio.outputFiles[0].text
		// @ts-expect-error global injection for tests
		globalThis.__SMITHERY_VERSION__ = "1.0.0-test"
	})

	afterAll(() => {
		if (existsSync(OUT_DIR)) {
			rmSync(OUT_DIR, { recursive: true, force: true })
		}
	})

	describe("stateless server", () => {
		let devServer: Awaited<ReturnType<typeof createDevServer>>
		const port = 9100
		const serverUrl = `http://127.0.0.1:${port}`
		const outFile = join(OUT_DIR, "stateless/module.js")

		beforeAll(async () => {
			await buildServer({
				entryFile: join(FIXTURES, "stateless-server/src/index.ts"),
				outFile,
				transport: "shttp",
				minify: false,
			})

			devServer = await createDevServer({
				port,
				modulePath: outFile,
			})
		}, 30000)

		afterAll(async () => {
			await devServer?.close()
		})

		test("initialize and list tools", async () => {
			const { json: initJson } = await mcpRequest(serverUrl, "initialize", {
				protocolVersion: "2024-11-05",
				capabilities: {},
				clientInfo: { name: "test-client", version: "1.0.0" },
			})
			expect(initJson.result.serverInfo.name).toBe("test-stateless-server")

			const { json: toolsJson } = await mcpRequest(serverUrl, "tools/list", {})
			expect(toolsJson.result.tools).toContainEqual(
				expect.objectContaining({ name: "increment" }),
			)
		})

		test("stateless: each call gets fresh state (callCount always 1)", async () => {
			// In stateless mode, each request creates a fresh server instance
			// Local variables reset between requests
			const { json: res1 } = await mcpRequest(serverUrl, "tools/call", {
				name: "increment",
				arguments: {},
			})
			const { json: res2 } = await mcpRequest(serverUrl, "tools/call", {
				name: "increment",
				arguments: {},
			})

			const val1 = JSON.parse(res1.result.content[0].text).callCount
			const val2 = JSON.parse(res2.result.content[0].text).callCount

			expect(val1).toBe(1)
			expect(val2).toBe(1)
		})

		test("config from URL query params with dot-notation", async () => {
			// Test that query params are parsed into config with dot-notation support
			const urlWithConfig = `${serverUrl}?apiKey=test-key-123&timeout=5000&nested.value=deep`

			const { json: initJson } = await mcpRequest(urlWithConfig, "initialize", {
				protocolVersion: "2026-01-07",
				capabilities: {},
				clientInfo: { name: "test-client", version: "1.0.0" },
			})
			expect(initJson.result.serverInfo.name).toBe("test-stateless-server")

			// Call get_config tool to verify config was parsed correctly
			const { json: configJson } = await mcpRequest(
				urlWithConfig,
				"tools/call",
				{ name: "get_config", arguments: {} },
			)

			const config = JSON.parse(configJson.result.content[0].text)
			expect(config.apiKey).toBe("test-key-123")
			expect(config.timeout).toBe(5000) // Should be parsed as number
			expect(config.nested).toEqual({ value: "deep" }) // Dot notation expanded
		})
	})

	describe("stateful server", () => {
		let devServer: Awaited<ReturnType<typeof createDevServer>>
		const port = 9101
		const serverUrl = `http://127.0.0.1:${port}`
		const outFile = join(OUT_DIR, "stateful/module.js")

		beforeAll(async () => {
			await buildServer({
				entryFile: join(FIXTURES, "stateful-server/src/index.ts"),
				outFile,
				transport: "shttp",
				minify: false,
			})

			devServer = await createDevServer({
				port,
				modulePath: outFile,
			})
		}, 30000)

		afterAll(async () => {
			await devServer?.close()
		})

		test("stateful: session.get/set persists state across requests", async () => {
			// First request - initialize and get session ID
			const { json: initJson, sessionId } = await mcpRequest(
				serverUrl,
				"initialize",
				{
					protocolVersion: "2024-11-05",
					capabilities: {},
					clientInfo: { name: "test-client", version: "1.0.0" },
				},
			)
			expect(initJson.result.serverInfo.name).toBe("test-stateful-server")
			expect(sessionId).toBeTruthy()

			// Call increment twice with same session
			const { json: res1 } = await mcpRequest(
				serverUrl,
				"tools/call",
				{ name: "increment", arguments: {} },
				sessionId!,
			)
			const { json: res2 } = await mcpRequest(
				serverUrl,
				"tools/call",
				{ name: "increment", arguments: {} },
				sessionId!,
			)

			const val1 = JSON.parse(res1.result.content[0].text).callCount
			const val2 = JSON.parse(res2.result.content[0].text).callCount

			// State persists via session.get/set
			expect(val1).toBe(1)
			expect(val2).toBe(2)
		})

		test("stateful: different sessions have isolated state", async () => {
			// Session A
			const { sessionId: sessionA } = await mcpRequest(
				serverUrl,
				"initialize",
				{
					protocolVersion: "2024-11-05",
					capabilities: {},
					clientInfo: { name: "test", version: "1" },
				},
			)

			// Session B
			const { sessionId: sessionB } = await mcpRequest(
				serverUrl,
				"initialize",
				{
					protocolVersion: "2024-11-05",
					capabilities: {},
					clientInfo: { name: "test", version: "1" },
				},
			)

			expect(sessionA).toBeTruthy()
			expect(sessionB).toBeTruthy()
			expect(sessionA).not.toBe(sessionB)

			// Increment in session A
			const { json: resA } = await mcpRequest(
				serverUrl,
				"tools/call",
				{ name: "increment", arguments: {} },
				sessionA!,
			)

			// Increment in session B
			const { json: resB } = await mcpRequest(
				serverUrl,
				"tools/call",
				{ name: "increment", arguments: {} },
				sessionB!,
			)

			const valA = JSON.parse(resA.result.content[0].text).callCount
			const valB = JSON.parse(resB.result.content[0].text).callCount

			// Each session starts fresh
			expect(valA).toBe(1)
			expect(valB).toBe(1)
		})
	})

	describe("stdio bundle execution", () => {
		const outFile = join(OUT_DIR, "stdio/index.cjs")

		beforeAll(async () => {
			// Build stdio bundle with bootstrap mode
			await buildServer({
				entryFile: join(FIXTURES, "stateful-server/src/index.ts"),
				outFile,
				transport: "stdio",
				bundleMode: "bootstrap",
				minify: false,
			})
		})

		test("built bundle starts and responds to MCP requests", async () => {
			// Create transport that spawns the built bundle
			// Pass config args in dot notation format (parsed by bootstrap's parseCliConfig)
			const transport = new StdioClientTransport({
				command: "node",
				args: [outFile, "sessionTimeout=3600", "maxConnections=100"],
			})

			// Create MCP client and connect - this handles the initialize handshake
			const client = new Client({ name: "test-client", version: "1.0.0" })
			await client.connect(transport)

			// Verify server info from successful connection
			const serverInfo = client.getServerVersion()
			expect(serverInfo?.name).toBe("test-stateful-server")

			// Can also verify tools are available
			const { tools } = await client.listTools()
			expect(tools).toContainEqual(
				expect.objectContaining({ name: "increment" }),
			)

			await client.close()
		})
	})
})
