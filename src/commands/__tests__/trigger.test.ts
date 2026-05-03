import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockListTriggers,
	mockGetTrigger,
	mockSubscribeTrigger,
	mockUnsubscribeTrigger,
	mockCreateSession,
	mockOutputTable,
	mockOutputDetail,
	mockOutputJson,
} = vi.hoisted(() => {
	const listTriggers = vi.fn()
	const getTrigger = vi.fn()
	const subscribeTrigger = vi.fn()
	const unsubscribeTrigger = vi.fn()
	const createSession = vi.fn(async () => ({
		listTriggers,
		getTrigger,
		subscribeTrigger,
		unsubscribeTrigger,
	}))

	return {
		mockListTriggers: listTriggers,
		mockGetTrigger: getTrigger,
		mockSubscribeTrigger: subscribeTrigger,
		mockUnsubscribeTrigger: unsubscribeTrigger,
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
	getTrigger,
	listTriggers,
	subscribeTrigger,
	unsubscribeTrigger,
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

	test("prints a preview warning before trigger commands", async () => {
		mockListTriggers.mockResolvedValue([])
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

		await listTriggers("notion", {})

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Triggers are in preview"),
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

	test("gets trigger schemas from the trigger catalog", async () => {
		mockGetTrigger.mockResolvedValue({
			name: "page.updated",
			description: "Fires when a page changes.",
			delivery: ["webhook"],
			inputSchema: { type: "object" },
			payloadSchema: { type: "object" },
		})

		await getTrigger("notion", "page.updated", {})

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

	test("subscribes with delivery url + secret and returns id + refreshBefore", async () => {
		mockSubscribeTrigger.mockResolvedValue({
			id: "sub_123",
			refreshBefore: "2026-05-02T12:00:00.000Z",
		})

		await subscribeTrigger(
			"notion",
			"page.updated",
			'{"workspace_id":"w_123"}',
			{
				url: "https://my-app.example.com/events",
				secret: "whsec_dGVzdF9zZWNyZXRfMjRfYnl0ZXNfbWluaW11bSE=",
			},
		)

		expect(mockSubscribeTrigger).toHaveBeenCalledWith(
			"notion",
			"page.updated",
			{ workspace_id: "w_123" },
			{
				url: "https://my-app.example.com/events",
				secret: "whsec_dGVzdF9zZWNyZXRfMjRfYnl0ZXNfbWluaW11bSE=",
			},
		)
		expect(mockOutputDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					id: "sub_123",
					refreshBefore: "2026-05-02T12:00:00.000Z",
					connection: "notion",
					name: "page.updated",
					url: "https://my-app.example.com/events",
				}),
			}),
		)
	})

	test("requires --url and --secret to subscribe", async () => {
		await expect(
			subscribeTrigger("notion", "page.updated", undefined, {}),
		).rejects.toThrow("process.exit")

		await expect(
			subscribeTrigger("notion", "page.updated", undefined, {
				url: "https://my-app.example.com/events",
			}),
		).rejects.toThrow("process.exit")
	})

	test("unsubscribes by params + delivery url", async () => {
		mockUnsubscribeTrigger.mockResolvedValue(undefined)

		await unsubscribeTrigger(
			"notion",
			"page.updated",
			'{"workspace_id":"w_123"}',
			{ url: "https://my-app.example.com/events" },
		)

		expect(mockUnsubscribeTrigger).toHaveBeenCalledWith(
			"notion",
			"page.updated",
			{ workspace_id: "w_123" },
			"https://my-app.example.com/events",
		)
	})

	test("requires --url when unsubscribing", async () => {
		await expect(
			unsubscribeTrigger("notion", "page.updated", undefined, {}),
		).rejects.toThrow("process.exit")
	})

	test("registers trigger commands and hides the trigger group from help", () => {
		const triggerCmd = program.commands.find(
			(command) => command.name() === "trigger",
		)

		expect(triggerCmd).toBeDefined()
		expect((triggerCmd as unknown as { _hidden?: boolean })._hidden).toBe(true)
		expect(
			triggerCmd?.commands.map((command) => command.name()).sort(),
		).toEqual(["get", "list", "subscribe", "unsubscribe"])
	})
})
