import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { setOutputMode } from "../../utils/output"
import { outputConnectionDetail } from "../mcp/output-connection"

describe("outputConnectionDetail", () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		setOutputMode({ table: true })
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
		setOutputMode({})
	})

	test("renders missing headers and query params for input_required connections", () => {
		outputConnectionDetail({
			connection: {
				connectionId: "test-input-required-two",
				name: "test-input-required-two",
				mcpUrl: "https://server.smithery.ai/calclavia/test-input-required-two",
				metadata: null,
				status: {
					state: "input_required",
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
				},
			} as never,
		})

		const lines = consoleLogSpy.mock.calls.map(([line]) => String(line))
		expect(lines).toContainEqual(expect.stringContaining("Missing headers:"))
		expect(lines).toContainEqual(expect.stringContaining("x-api-key"))
		expect(lines).toContainEqual(expect.stringContaining("Manual test header"))
		expect(lines).toContainEqual(
			expect.stringContaining("Missing query params:"),
		)
		expect(lines).toContainEqual(expect.stringContaining("projectId"))
		expect(lines).toContainEqual(expect.stringContaining("Manual test query"))
	})
})
