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
				authorizationUrl: "https://example.com/oauth",
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
})
