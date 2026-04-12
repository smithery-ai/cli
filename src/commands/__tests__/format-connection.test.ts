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
})
