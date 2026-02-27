import { beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockListConnections,
	mockGetConnection,
	mockListToolsForConnection,
	mockCreateSession,
	mockOutputTable,
} = vi.hoisted(() => {
	const listConnections = vi.fn()
	const getConnection = vi.fn()
	const listToolsForConnection = vi.fn()
	const createSession = vi.fn(async () => ({
		listConnections,
		getConnection,
		listToolsForConnection,
	}))

	return {
		mockListConnections: listConnections,
		mockGetConnection: getConnection,
		mockListToolsForConnection: listToolsForConnection,
		mockCreateSession: createSession,
		mockOutputTable: vi.fn(),
	}
})

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

import { findTools } from "../mcp/search"

describe("tools find command", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		setOutputMode({ json: true })
	})

	test("supports connection-scoped exact matching", async () => {
		mockGetConnection.mockResolvedValue({
			connectionId: "posthog-QeNO",
			name: "posthog-QeNO",
			status: { state: "connected" },
		})
		mockListToolsForConnection.mockResolvedValue([
			{
				connectionId: "posthog-QeNO",
				connectionName: "posthog-QeNO",
				name: "experiment-get",
				description: "Get experiment details",
				inputSchema: { type: "object" },
			},
			{
				connectionId: "posthog-QeNO",
				connectionName: "posthog-QeNO",
				name: "experiment-results-get",
				description: "Get experiment results",
				inputSchema: { type: "object" },
			},
		])

		await findTools("experiment-results-get", {
			connection: "posthog-QeNO",
			match: "exact",
		})

		expect(mockGetConnection).toHaveBeenCalledWith("posthog-QeNO")
		expect(mockOutputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				json: true,
				jsonData: expect.objectContaining({
					mode: "exact",
					total: 1,
					tools: [
						expect.objectContaining({
							name: "experiment-results-get",
							connection: "posthog-QeNO",
						}),
					],
				}),
			}),
		)
	})

	test("filters tools by name prefix", async () => {
		mockGetConnection.mockResolvedValue({
			connectionId: "github-abc",
			name: "github-abc",
			status: { state: "connected" },
		})
		mockListToolsForConnection.mockResolvedValue([
			{
				connectionId: "github-abc",
				connectionName: "github-abc",
				name: "issues.create",
				description: "Create an issue",
				inputSchema: { type: "object" },
			},
			{
				connectionId: "github-abc",
				connectionName: "github-abc",
				name: "issues.list",
				description: "List issues",
				inputSchema: { type: "object" },
			},
			{
				connectionId: "github-abc",
				connectionName: "github-abc",
				name: "pulls.create",
				description: "Create a pull request",
				inputSchema: { type: "object" },
			},
		])

		await findTools(undefined, {
			connection: "github-abc",
			prefix: "issues.",
			all: true,
		})

		expect(mockOutputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				jsonData: expect.objectContaining({
					total: 2,
					prefix: "issues.",
					tools: expect.arrayContaining([
						expect.objectContaining({ name: "issues.create" }),
						expect.objectContaining({ name: "issues.list" }),
					]),
				}),
			}),
		)
	})

	test("prefix with no matches returns empty result", async () => {
		mockGetConnection.mockResolvedValue({
			connectionId: "github-abc",
			name: "github-abc",
			status: { state: "connected" },
		})
		mockListToolsForConnection.mockResolvedValue([
			{
				connectionId: "github-abc",
				connectionName: "github-abc",
				name: "pulls.create",
				description: "Create a PR",
				inputSchema: { type: "object" },
			},
		])

		await findTools(undefined, {
			connection: "github-abc",
			prefix: "issues.",
			all: true,
		})

		expect(mockOutputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				jsonData: expect.objectContaining({
					total: 0,
					tools: [],
				}),
			}),
		)
	})

	test("supports listing behavior via find --all without a query", async () => {
		mockListConnections.mockResolvedValue({
			connections: [
				{ connectionId: "posthog-QeNO", name: "posthog-QeNO" },
				{ connectionId: "notion-zgHR", name: "notion-zgHR" },
			],
			nextCursor: null,
		})
		mockListToolsForConnection
			.mockResolvedValueOnce([
				{
					connectionId: "posthog-QeNO",
					connectionName: "posthog-QeNO",
					name: "experiment-get",
					description: "Get experiment details",
					inputSchema: { type: "object" },
				},
			])
			.mockResolvedValueOnce([
				{
					connectionId: "notion-zgHR",
					connectionName: "notion-zgHR",
					name: "notion-fetch",
					description: "Fetch Notion page",
					inputSchema: { type: "object" },
				},
			])

		await findTools(undefined, { all: true })

		expect(mockListConnections).toHaveBeenCalled()
		expect(mockOutputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				json: true,
				jsonData: expect.objectContaining({
					all: true,
					total: 2,
					hasMore: false,
					tools: expect.arrayContaining([
						expect.objectContaining({ name: "experiment-get" }),
						expect.objectContaining({ name: "notion-fetch" }),
					]),
				}),
			}),
		)
	})
})
