import { describe, expect, test } from "vitest"
import { formatConnectionOutput } from "../mcp/format-connection"

describe("formatConnectionOutput", () => {
	test("preserves input_required status payload", () => {
		const status = {
			state: "input_required" as const,
			http: {
				headers: {
					"x-api-key": {
						label: "API Key",
						description: "Manual test header",
						required: true,
					},
				},
				query: {
					projectId: {
						label: "Project ID",
						description: "Manual test query",
						required: true,
					},
				},
			},
			missing: {
				headers: ["x-api-key"],
				query: ["projectId"],
			},
		}

		const output = formatConnectionOutput({
			connectionId: "test-input-required-two",
			name: "test-input-required-two",
			mcpUrl: "https://server.smithery.ai/calclavia/test-input-required-two",
			metadata: null,
			status,
		} as never)

		expect(output.status).toEqual(status)
	})

	test("prefers setupUrl for auth_required status output", () => {
		const output = formatConnectionOutput({
			connectionId: "github-oauth",
			name: "github-oauth",
			mcpUrl: "https://server.smithery.ai/github",
			metadata: null,
			status: {
				state: "auth_required",
				setupUrl: "https://smithery.ai/setup/github",
			},
		} as never)

		expect(output.status).toEqual({
			state: "auth_required",
			setupUrl: "https://smithery.ai/setup/github",
		})
	})

	test("does not expose iconUrl in CLI output", () => {
		const output = formatConnectionOutput({
			connectionId: "browserbase",
			name: "browserbase",
			mcpUrl: "https://server.smithery.ai/browserbase",
			metadata: null,
			status: { state: "connected" },
			iconUrl: "https://icons.duckduckgo.com/ip3/www.browserbase.com.ico",
		} as never)

		expect(output.iconUrl).toBeUndefined()
	})

	test("includes uplink transport and disconnected status", () => {
		const output = formatConnectionOutput({
			connectionId: "local-dev",
			name: "local-dev",
			mcpUrl: null,
			transport: "uplink",
			metadata: null,
			status: {
				state: "disconnected",
			},
		} as never)

		expect(output).toMatchObject({
			connectionId: "local-dev",
			name: "local-dev",
			mcpUrl: null,
			transport: "uplink",
			status: { state: "disconnected" },
		})
	})

	test("omits non-uplink transport from CLI output", () => {
		const output = formatConnectionOutput({
			connectionId: "remote-http",
			name: "remote-http",
			mcpUrl: "https://server.smithery.ai/remote-http",
			transport: "http",
			metadata: null,
			status: { state: "connected" },
		} as never)

		expect(output.transport).toBeUndefined()
	})

	test("preserves disconnected status payload", () => {
		const output = formatConnectionOutput({
			connectionId: "local-dev",
			name: "local-dev",
			mcpUrl: null,
			transport: "uplink",
			metadata: null,
			status: {
				state: "disconnected",
			},
		} as never)

		expect(output.status).toEqual({ state: "disconnected" })
	})
})
