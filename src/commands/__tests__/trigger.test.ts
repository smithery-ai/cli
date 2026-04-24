import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockListTriggers,
	mockGetTrigger,
	mockCreateTrigger,
	mockDeleteTrigger,
	mockListSubscriptions,
	mockCreateSubscription,
	mockCreateSession,
	mockOutputTable,
	mockOutputDetail,
	mockOutputJson,
} = vi.hoisted(() => {
	const listTriggers = vi.fn()
	const getTrigger = vi.fn()
	const createTrigger = vi.fn()
	const deleteTrigger = vi.fn()
	const listSubscriptions = vi.fn()
	const createSubscription = vi.fn()
	const createSession = vi.fn(async () => ({
		listTriggers,
		getTrigger,
		createTrigger,
		deleteTrigger,
		listSubscriptions,
		createSubscription,
	}))

	return {
		mockListTriggers: listTriggers,
		mockGetTrigger: getTrigger,
		mockCreateTrigger: createTrigger,
		mockDeleteTrigger: deleteTrigger,
		mockListSubscriptions: listSubscriptions,
		mockCreateSubscription: createSubscription,
		mockCreateSession: createSession,
		mockOutputTable: vi.fn(),
		mockOutputDetail: vi.fn(),
		mockOutputJson: vi.fn(),
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
		outputJson: mockOutputJson,
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

	test("prints a draft warning before trigger commands", async () => {
		mockListTriggers.mockResolvedValue([])
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

		await listTriggers("notion", {})

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"Triggers are in draft. Breaking change may happen without notice.",
			),
		)

		warnSpy.mockRestore()
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

	test("gets trigger schemas from the REST trigger catalog", async () => {
		mockGetTrigger.mockResolvedValue({
			name: "page.updated",
			description: "Fires when a page changes.",
			delivery: ["webhook"],
			inputSchema: { type: "object" },
			payloadSchema: { type: "object" },
		})

		const { getTrigger } = await import("../trigger")
		await getTrigger("notion", "page.updated", undefined, {})

		expect(mockGetTrigger).toHaveBeenCalledWith("notion", "page.updated")
		expect(mockOutputDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					name: "page.updated",
					inputSchema: { type: "object" },
				}),
			}),
		)
	})

	test("creates a trigger instance from JSON params over REST", async () => {
		mockCreateTrigger.mockResolvedValue({
			id: "trg_123",
			name: "page.updated",
			params: { workspace_id: "w_123" },
			created_at: "2026-04-24T00:00:00.000Z",
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
					name: "page.updated",
					params: { workspace_id: "w_123" },
				}),
			}),
		)
	})

	test("optionally creates a connection-scoped subscription before creating a trigger", async () => {
		mockListSubscriptions.mockResolvedValue([])
		mockCreateSubscription.mockResolvedValue({
			id: "sub_123",
			url: "https://hook.new/i/test",
			secret: "whsec_123",
		})
		mockCreateTrigger.mockResolvedValue({
			id: "trg_123",
			name: "page.updated",
			params: {},
			created_at: "2026-04-24T00:00:00.000Z",
		})

		await subscribeTrigger("notion", "page.updated", undefined, {
			url: "https://hook.new/i/test",
		})

		expect(mockListSubscriptions).toHaveBeenCalledWith("notion")
		expect(mockCreateSubscription).toHaveBeenCalledWith(
			"https://hook.new/i/test",
			"notion",
		)
		expect(mockCreateTrigger).toHaveBeenCalledWith("notion", "page.updated", {})
		expect(mockOutputDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					subscriptionId: "sub_123",
					secret: "whsec_123",
					url: "https://hook.new/i/test",
				}),
			}),
		)
	})

	test("requires trigger ids to be server-generated", async () => {
		await expect(
			subscribeTrigger("notion", "page.updated", undefined, {
				id: "custom-id",
			}),
		).rejects.toThrow("process.exit")
	})

	test("unsubscribes through the REST trigger endpoint", async () => {
		mockDeleteTrigger.mockResolvedValue(undefined)

		const { unsubscribeTrigger } = await import("../trigger")
		await unsubscribeTrigger("notion", "page.updated", "trg_123", {})

		expect(mockDeleteTrigger).toHaveBeenCalledWith(
			"notion",
			"page.updated",
			"trg_123",
		)
	})

	test("requires a trigger id when deleting a trigger instance", async () => {
		const { unsubscribeTrigger } = await import("../trigger")

		await expect(
			unsubscribeTrigger("notion", "page.updated", undefined, {}),
		).rejects.toThrow("process.exit")
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
