import { beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockGetConnection,
	mockListToolsForConnection,
	mockCreateSession,
	mockOutputDetail,
	mockOutputJson,
} = vi.hoisted(() => {
	const getConnection = vi.fn()
	const listToolsForConnection = vi.fn()
	const createSession = vi.fn(async () => ({
		getConnection,
		listToolsForConnection,
	}))

	return {
		mockGetConnection: getConnection,
		mockListToolsForConnection: listToolsForConnection,
		mockCreateSession: createSession,
		mockOutputDetail: vi.fn(),
		mockOutputJson: vi.fn(),
	}
})

vi.mock("../connect/api", () => ({
	ConnectSession: {
		create: mockCreateSession,
	},
}))

vi.mock("../../utils/output", () => ({
	outputDetail: mockOutputDetail,
	outputJson: mockOutputJson,
}))

import { getTool } from "../connect/tool"

describe("tools get command", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("returns full tool details without truncating description", async () => {
		const longDescription =
			"Creates an insight and pins it to a target dashboard with complete insight metadata."

		mockGetConnection.mockResolvedValue({
			connectionId: "posthog",
			name: "PostHog",
		})
		mockListToolsForConnection.mockResolvedValue([
			{
				connectionId: "posthog",
				connectionName: "PostHog",
				name: "add-insight-to-dashboard",
				description: longDescription,
				inputSchema: { type: "object" },
				outputSchema: { type: "object" },
			},
		])

		await getTool("posthog/add-insight-to-dashboard", { json: false })

		expect(mockCreateSession).toHaveBeenCalledWith(undefined)
		expect(mockOutputDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				json: false,
				data: expect.objectContaining({
					id: "posthog/add-insight-to-dashboard",
					description: longDescription,
					inputSchema: { type: "object" },
					outputSchema: { type: "object" },
				}),
			}),
		)
		expect(mockOutputJson).not.toHaveBeenCalled()
	})

	test("returns error for invalid tool-id format", async () => {
		await expect(getTool("posthog", { json: true })).rejects.toThrow(
			"process.exit() was called",
		)

		expect(mockOutputJson).toHaveBeenCalledWith(
			expect.objectContaining({
				tool: null,
				error: expect.stringContaining('Expected "connection/tool-name"'),
			}),
		)
	})

	test("returns error when tool is missing from the specified connection", async () => {
		mockGetConnection.mockResolvedValue({
			connectionId: "posthog",
			name: "PostHog",
		})
		mockListToolsForConnection.mockResolvedValue([
			{
				connectionId: "posthog",
				connectionName: "PostHog",
				name: "create-dashboard",
				description: "Create a dashboard",
				inputSchema: { type: "object" },
			},
		])

		await expect(
			getTool("posthog/add-insight-to-dashboard", { json: true }),
		).rejects.toThrow("process.exit() was called")

		expect(mockOutputJson).toHaveBeenCalledWith(
			expect.objectContaining({
				tool: null,
				error: expect.stringContaining(
					'Tool "add-insight-to-dashboard" was not found',
				),
			}),
		)
	})

	test("supports tool names containing slashes", async () => {
		mockGetConnection.mockResolvedValue({
			connectionId: "posthog",
			name: "PostHog",
		})
		mockListToolsForConnection.mockResolvedValue([
			{
				connectionId: "posthog",
				connectionName: "PostHog",
				name: "insights/add-to-dashboard",
				description: "Nested tool name",
				inputSchema: { type: "object" },
			},
		])

		await getTool("posthog/insights/add-to-dashboard", { json: false })

		expect(mockOutputDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					id: "posthog/insights/add-to-dashboard",
					name: "insights/add-to-dashboard",
				}),
			}),
		)
	})
})
