import { beforeEach, describe, expect, test, vi } from "vitest"

const { mockListConnections, mockCreateSession, mockOutputTable } = vi.hoisted(
	() => {
		const listConnections = vi.fn()
		const createSession = vi.fn(async () => ({
			listConnections,
		}))
		return {
			mockListConnections: listConnections,
			mockCreateSession: createSession,
			mockOutputTable: vi.fn(),
		}
	},
)

vi.mock("../mcp/api", () => ({
	ConnectSession: {
		create: mockCreateSession,
	},
}))

vi.mock("../../utils/output", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../utils/output")>()
	return {
		...actual,
		outputTable: mockOutputTable,
	}
})

import { setOutputMode } from "../../utils/output"
import { listServers } from "../mcp/list"

describe("mcp list command", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		setOutputMode({ json: true })
	})

	test("passes metadata filter through to connection listing", async () => {
		mockListConnections.mockResolvedValue({
			connections: [
				{
					connectionId: "github-1",
					name: "github-1",
					mcpUrl: "https://github.run.tools",
					status: { state: "connected" },
				},
			],
			nextCursor: null,
		})

		await listServers({
			namespace: "prod",
			metadata: '{"userId":"user-123"}',
			limit: "5",
			cursor: "cursor-1",
		})

		expect(mockCreateSession).toHaveBeenCalledWith("prod")
		expect(mockListConnections).toHaveBeenCalledWith({
			metadata: { userId: "user-123" },
			limit: 5,
			cursor: "cursor-1",
		})
		expect(mockOutputTable).toHaveBeenCalled()
	})

	test("preserves input_required status in output rows", async () => {
		mockListConnections.mockResolvedValue({
			connections: [
				{
					connectionId: "test-input-required-two",
					name: "test-input-required-two",
					mcpUrl:
						"https://server.smithery.ai/calclavia/test-input-required-two",
					status: {
						state: "input_required",
						http: {},
						missing: { headers: ["x-api-key"], query: ["projectId"] },
					},
				},
			],
			nextCursor: null,
		})

		await listServers({})

		expect(mockOutputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				jsonData: expect.objectContaining({
					servers: [
						expect.objectContaining({
							status: "input_required",
						}),
					],
				}),
			}),
		)
	})
})
