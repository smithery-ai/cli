import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockListTriggers,
	mockCreateTrigger,
	mockListSubscriptions,
	mockCreateSubscription,
	mockCreateSession,
	mockOutputTable,
	mockOutputDetail,
} = vi.hoisted(() => {
	const listTriggers = vi.fn()
	const createTrigger = vi.fn()
	const listSubscriptions = vi.fn()
	const createSubscription = vi.fn()
	const createSession = vi.fn(async () => ({
		listTriggers,
		createTrigger,
		listSubscriptions,
		createSubscription,
	}))

	return {
		mockListTriggers: listTriggers,
		mockCreateTrigger: createTrigger,
		mockListSubscriptions: listSubscriptions,
		mockCreateSubscription: createSubscription,
		mockCreateSession: createSession,
		mockOutputTable: vi.fn(),
		mockOutputDetail: vi.fn(),
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
		outputDetail: mockOutputDetail,
	}
})

import { setOutputMode } from "../../utils/output"
import {
	createSubscription,
	listSubscriptions,
	listTriggers,
	subscribeTrigger,
} from "../trigger"

let program: typeof import("../../index").program
const testGlobal = globalThis as typeof globalThis & {
	__SMITHERY_VERSION__: string
}

beforeAll(async () => {
	testGlobal.__SMITHERY_VERSION__ = "test"
	;({ program } = await import("../../index"))
})

describe("trigger commands", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		setOutputMode({ json: true })
	})

	test("lists trigger types for a connection", async () => {
		mockListTriggers.mockResolvedValue([
			{
				name: "page.updated",
				description: "Fires when a page changes.",
				delivery: ["webhook"],
				inputSchema: { type: "object" },
			},
		])

		await listTriggers("notion", { namespace: "prod" })

		expect(mockCreateSession).toHaveBeenCalledWith("prod")
		expect(mockListTriggers).toHaveBeenCalledWith("notion")
		expect(mockOutputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				jsonData: expect.objectContaining({
					triggers: [
						expect.objectContaining({
							name: "page.updated",
						}),
					],
				}),
			}),
		)
	})

	test("creates a trigger instance from JSON params", async () => {
		mockCreateTrigger.mockResolvedValue({
			id: "trg_123",
			name: "page.updated",
			connection_id: "notion",
			params: { workspace_id: "w_123" },
			created_at: "2026-04-22T12:00:00.000Z",
		})

		await subscribeTrigger(
			"notion",
			"page.updated",
			'{"workspace_id":"w_123"}',
			{},
		)

		expect(mockCreateTrigger).toHaveBeenCalledWith("notion", "page.updated", {
			workspace_id: "w_123",
		})
		expect(mockOutputDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					id: "trg_123",
					connection: "notion",
				}),
			}),
		)
	})

	test("lists connection-scoped subscriptions", async () => {
		mockListSubscriptions.mockResolvedValue([
			{ id: "sub_123", url: "https://example.com/events" },
		])

		await listSubscriptions("notion", {})

		expect(mockListSubscriptions).toHaveBeenCalledWith("notion")
		expect(mockOutputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				jsonData: expect.objectContaining({
					subscriptions: [{ id: "sub_123", url: "https://example.com/events" }],
				}),
			}),
		)
	})

	test("creates namespace-scoped subscriptions when no connection is passed", async () => {
		mockCreateSubscription.mockResolvedValue({
			id: "sub_123",
			url: "https://example.com/events",
			secret: "whsec_123",
		})

		await createSubscription("https://example.com/events", undefined, {})

		expect(mockCreateSession).toHaveBeenCalledWith(undefined)
		expect(mockCreateSubscription).toHaveBeenCalledWith(
			"https://example.com/events",
			undefined,
		)
	})

	test("registers trigger and subscription commands", () => {
		const triggerCmd = program.commands.find(
			(command) => command.name() === "trigger",
		)
		const subCmd = triggerCmd?.commands.find(
			(command) => command.name() === "subscription",
		)

		expect(triggerCmd).toBeDefined()
		expect(
			triggerCmd?.commands.map((command) => command.name()).sort(),
		).toEqual(["get", "list", "subscribe", "subscription", "unsubscribe"])
		expect(subCmd?.commands.map((command) => command.name()).sort()).toEqual([
			"add",
			"list",
			"remove",
		])
	})
})
