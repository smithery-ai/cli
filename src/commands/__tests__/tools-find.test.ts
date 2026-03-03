import { beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockGetConnection,
	mockListToolsForConnection,
	mockCreateSession,
	mockOutputTable,
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

	test("groups tools at root level", async () => {
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
			{
				connectionId: "github-abc",
				connectionName: "github-abc",
				name: "search",
				description: "Search across repos",
				inputSchema: { type: "object" },
			},
		])

		await findTools(undefined, {
			connection: "github-abc",
			prefix: undefined,
		})

		expect(mockOutputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				jsonData: expect.objectContaining({
					connection: "github-abc",
					total: 3,
					tools: [
						{
							type: "group",
							name: "issues.",
							count: 2,
							preview: "Create an issue",
						},
						{
							type: "tool",
							name: "search",
							description: "Search across repos",
							inputSchema: { type: "object" },
						},
						{
							type: "tool",
							name: "pulls.create",
							description: "Create a pull request",
							inputSchema: { type: "object" },
						},
					],
				}),
			}),
		)
	})

	test("drills into prefix showing leaf tools and subgroups", async () => {
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
				name: "issues.labels.add",
				description: "Add a label",
				inputSchema: { type: "object" },
			},
			{
				connectionId: "github-abc",
				connectionName: "github-abc",
				name: "issues.labels.remove",
				description: "Remove a label",
				inputSchema: { type: "object" },
			},
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
		})

		expect(mockOutputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				jsonData: expect.objectContaining({
					connection: "github-abc",
					total: 3,
					prefix: "issues.",
					tools: [
						{
							type: "group",
							name: "issues.labels.",
							count: 2,
							preview: "Add a label",
						},
						{
							type: "tool",
							name: "issues.create",
							description: "Create an issue",
							inputSchema: { type: "object" },
						},
						{
							type: "tool",
							name: "issues.list",
							description: "List issues",
							inputSchema: { type: "object" },
						},
					],
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
		})

		expect(mockOutputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				jsonData: expect.objectContaining({
					connection: "github-abc",
					total: 0,
					tools: [],
				}),
			}),
		)
	})

	test("supports --flat flag to list tools without grouping", async () => {
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

		await findTools(undefined, {
			connection: "posthog-QeNO",
			prefix: undefined,
			flat: true,
		})

		expect(mockGetConnection).toHaveBeenCalledWith("posthog-QeNO")
		expect(mockOutputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				json: true,
				jsonData: expect.objectContaining({
					flat: true,
					total: 2,
					hasMore: false,
					tools: expect.arrayContaining([
						expect.objectContaining({ name: "experiment-get" }),
						expect.objectContaining({ name: "experiment-results-get" }),
					]),
				}),
			}),
		)
	})
})
