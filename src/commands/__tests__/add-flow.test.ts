import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const { mockPromptForConnectionInputs } = vi.hoisted(() => ({
	mockPromptForConnectionInputs: vi.fn(),
}))

vi.mock("../../utils/command-prompts", () => ({
	promptForConnectionInputs: mockPromptForConnectionInputs,
}))

import { setOutputMode } from "../../utils/output"
import {
	buildDuplicateInputRequiredTip,
	finalizeAddedConnection,
} from "../mcp/add-flow"

describe("add flow", () => {
	const originalStdinTTY = process.stdin.isTTY
	const originalStdoutTTY = process.stdout.isTTY

	beforeEach(() => {
		vi.clearAllMocks()
		setOutputMode({ table: true })
		process.stdin.isTTY = true
		process.stdout.isTTY = true
	})

	afterEach(() => {
		setOutputMode({})
		process.stdin.isTTY = originalStdinTTY
		process.stdout.isTTY = originalStdoutTTY
	})

	test("prompts for missing inputs and updates the same connection until stable", async () => {
		mockPromptForConnectionInputs.mockResolvedValue({
			headers: { "x-api-key": "secret-123" },
			query: { projectId: "proj-123" },
		})

		const session = {
			setConnection: vi.fn().mockResolvedValue({
				connectionId: "test-input-required-two",
				name: "test-input-required-two",
				mcpUrl:
					"https://server.smithery.ai/calclavia/test-input-required-two?projectId=proj-123",
				metadata: null,
				status: {
					state: "auth_required",
					authorizationUrl: "https://example.com/oauth",
				},
			}),
		}

		const connection = await finalizeAddedConnection(
			session as never,
			{
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
			{
				name: "test-input-required-two",
			},
		)

		expect(mockPromptForConnectionInputs).toHaveBeenCalledWith(
			expect.objectContaining({
				state: "input_required",
			}),
		)
		expect(session.setConnection).toHaveBeenCalledWith(
			"test-input-required-two",
			"https://server.smithery.ai/calclavia/test-input-required-two?projectId=proj-123",
			expect.objectContaining({
				name: "test-input-required-two",
				headers: { "x-api-key": "secret-123" },
			}),
		)
		expect(connection.status).toEqual({
			state: "auth_required",
			authorizationUrl: "https://example.com/oauth",
		})
	})

	test("returns unresolved connection unchanged in json mode", async () => {
		setOutputMode({ json: true })

		const session = {
			setConnection: vi.fn(),
		}
		const connection = {
			connectionId: "test-input-required-two",
			name: "test-input-required-two",
			mcpUrl: "https://server.smithery.ai/calclavia/test-input-required-two",
			metadata: null,
			status: {
				state: "input_required",
				http: {},
				missing: {
					headers: [],
					query: ["projectId"],
				},
			},
		}

		const result = await finalizeAddedConnection(
			session as never,
			connection as never,
			{},
		)

		expect(mockPromptForConnectionInputs).not.toHaveBeenCalled()
		expect(session.setConnection).not.toHaveBeenCalled()
		expect(result).toBe(connection)
	})

	test("builds a remove and re-add hint for unresolved duplicates", () => {
		const tip = buildDuplicateInputRequiredTip({
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
							required: true,
						},
					},
					query: {
						projectId: {
							label: "Project ID",
							required: true,
						},
					},
				},
				missing: {
					headers: ["x-api-key"],
					query: ["projectId"],
				},
			},
		} as never)

		expect(tip).toContain("smithery mcp remove test-input-required-two")
		expect(tip).toContain(
			"smithery mcp add 'https://server.smithery.ai/calclavia/test-input-required-two?projectId=...'",
		)
		expect(tip).toContain(`--headers '{"x-api-key":"..."}'`)
	})
})
