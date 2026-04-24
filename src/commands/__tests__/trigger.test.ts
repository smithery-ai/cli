import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockListEventTriggers,
	mockCreateTrigger,
	mockListSubscriptions,
	mockCreateSubscription,
	mockCreateSession,
	mockGetEventsClient,
	mockOutputTable,
	mockOutputDetail,
	mockOutputJson,
} = vi.hoisted(() => {
	const listEventTriggers = vi.fn()
	const createTrigger = vi.fn()
	const listSubscriptions = vi.fn()
	const createSubscription = vi.fn()
	const request = vi.fn()
	const close = vi.fn().mockResolvedValue(undefined)
	const getEventsClient = vi.fn(async () => ({ request, close }))
	const createSession = vi.fn(async () => ({
		listEventTriggers,
		createTrigger,
		listSubscriptions,
		createSubscription,
		getEventsClient,
	}))

	return {
		mockListEventTriggers: listEventTriggers,
		mockCreateTrigger: createTrigger,
		mockListSubscriptions: listSubscriptions,
		mockCreateSubscription: createSubscription,
		mockCreateSession: createSession,
		mockGetEventsClient: getEventsClient,
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

	test("lists trigger types for a connection", async () => {
	mockListEventTriggers.mockResolvedValue([
			{
				name: "page.updated",
				description: "Fires when a page changes.",
				delivery: ["webhook"],
				inputSchema: { type: "object" },
			},
		])

		await listTriggers("notion", { namespace: "prod" })

		expect(mockCreateSession).toHaveBeenCalledWith("prod")
		expect(mockListEventTriggers).toHaveBeenCalledWith("notion")
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

	test("gets trigger schemas from the MCP trigger catalog", async () => {
		mockListEventTriggers.mockResolvedValue([
			{
				name: "page.updated",
				description: "Fires when a page changes.",
				delivery: ["webhook"],
				inputSchema: { type: "object" },
				payloadSchema: { type: "object" },
			},
		])

		const { getTrigger } = await import("../trigger")
		await getTrigger("notion", "page.updated", undefined, {})

		expect(mockListEventTriggers).toHaveBeenCalledWith("notion")
		expect(mockOutputDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					name: "page.updated",
					inputSchema: { type: "object" },
				}),
			}),
		)
	})

	test("creates a trigger instance from JSON params", async () => {
		const request = vi.fn().mockResolvedValue({ subscriptionId: "trg_123" })
		const close = vi.fn().mockResolvedValue(undefined)
		mockGetEventsClient.mockResolvedValue({ request, close })

		await subscribeTrigger(
			"notion",
			"page.updated",
			'{"workspace_id":"w_123"}',
			{ url: "https://hook.new/i/test" },
		)

		expect(request).toHaveBeenCalledWith(
			{
				method: "ai.smithery/events/subscribe",
				params: {
					name: "page.updated",
					id: expect.any(String),
					params: { workspace_id: "w_123" },
					delivery: {
						mode: "webhook",
						url: "https://hook.new/i/test",
					},
				},
			},
			expect.anything(),
		)
		expect(mockOutputDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					subscriptionId: "trg_123",
					connection: "notion",
					name: "page.updated",
					url: "https://hook.new/i/test",
				}),
			}),
		)
		expect(close).toHaveBeenCalled()
	})

	test("requires a delivery URL when creating a trigger instance", async () => {
		await expect(
			subscribeTrigger("notion", "page.updated", undefined, {}),
		).rejects.toThrow("process.exit")
	})

	test("unsubscribes through the MCP events extension", async () => {
		const request = vi.fn().mockResolvedValue({})
		const close = vi.fn().mockResolvedValue(undefined)
		mockGetEventsClient.mockResolvedValue({ request, close })

		const { unsubscribeTrigger } = await import("../trigger")
		await unsubscribeTrigger("notion", "page.updated", undefined, {})

		expect(request).toHaveBeenCalledWith(
			{
				method: "ai.smithery/events/unsubscribe",
				params: { topic: "page.updated" },
			},
			expect.anything(),
		)
		expect(close).toHaveBeenCalled()
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
