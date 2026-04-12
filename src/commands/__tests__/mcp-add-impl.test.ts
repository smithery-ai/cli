import { beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockListConnectionsByUrl,
	mockCreateConnection,
	mockCreateSession,
	mockOutputConnectionDetail,
} = vi.hoisted(() => {
	const listConnectionsByUrl = vi.fn()
	const createConnection = vi.fn()
	const createSession = vi.fn(async () => ({
		listConnectionsByUrl,
		createConnection,
	}))

	return {
		mockListConnectionsByUrl: listConnectionsByUrl,
		mockCreateConnection: createConnection,
		mockCreateSession: createSession,
		mockOutputConnectionDetail: vi.fn(),
	}
})

vi.mock("../mcp/api", () => ({
	ConnectSession: {
		create: mockCreateSession,
	},
}))

vi.mock("../mcp/output-connection", () => ({
	outputConnectionDetail: mockOutputConnectionDetail,
}))

import { addServer } from "../mcp/add-impl"

describe("mcp add duplicate handling", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("shows a remove and re-add hint for unresolved duplicate connections", async () => {
		mockListConnectionsByUrl.mockResolvedValue({
			connections: [
				{
					connectionId: "test-input-required-two",
					name: "test-input-required-two",
					mcpUrl:
						"https://server.smithery.ai/calclavia/test-input-required-two",
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
				},
			],
		})

		await addServer("calclavia/test-input-required-two", {})

		expect(mockCreateConnection).not.toHaveBeenCalled()
		expect(mockOutputConnectionDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				connection: expect.objectContaining({
					connectionId: "test-input-required-two",
				}),
				tip: expect.stringContaining(
					"smithery mcp remove test-input-required-two",
				),
			}),
		)
	})
})
