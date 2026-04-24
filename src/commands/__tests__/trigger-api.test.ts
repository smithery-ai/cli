import { describe, expect, test, vi } from "vitest"
import { ConnectSession } from "../mcp/api"

describe("ConnectSession trigger support", () => {
	test("uses trigger endpoints for trigger types and instances", async () => {
		const get = vi
			.fn()
			.mockResolvedValueOnce({ triggers: [] })
			.mockResolvedValueOnce({ name: "page.updated" })
			.mockResolvedValueOnce({ id: "trg_123" })
		const post = vi
			.fn()
			.mockResolvedValueOnce({ id: "trg_123" })
			.mockResolvedValueOnce({ id: "sub_123" })
			.mockResolvedValueOnce({ id: "sub_456" })
		const del = vi.fn().mockResolvedValue({ success: true })

		const session = new ConnectSession(
			{ get, post, delete: del } as never,
			"my app",
		)

		await session.listTriggers("notion")
		await session.getTrigger("notion", "page.updated")
		await session.createTrigger("notion", "page.updated", {
			workspace_id: "w_123",
		})
		await session.getTriggerInstance("notion", "page.updated", "trg_123")
		await session.deleteTrigger("notion", "page.updated", "trg_123")
		await session.listSubscriptions()
		await session.createSubscription("https://example.com/events")
		await session.listSubscriptions("notion")
		await session.createSubscription("https://example.com/notion", "notion")
		await session.deleteSubscription("sub_123")
		await session.deleteSubscription("sub_456", "notion")

		expect(get).toHaveBeenNthCalledWith(1, "/my%20app/notion/triggers")
		expect(get).toHaveBeenNthCalledWith(
			2,
			"/my%20app/notion/triggers/page.updated",
		)
		expect(post).toHaveBeenNthCalledWith(
			1,
			"/my%20app/notion/triggers/page.updated",
			{
				body: { params: { workspace_id: "w_123" } },
			},
		)
		expect(get).toHaveBeenNthCalledWith(
			3,
			"/my%20app/notion/triggers/page.updated/trg_123",
		)
		expect(del).toHaveBeenNthCalledWith(
			1,
			"/my%20app/notion/triggers/page.updated/trg_123",
		)
		expect(get).toHaveBeenNthCalledWith(4, "/my%20app/subscriptions")
		expect(post).toHaveBeenNthCalledWith(2, "/my%20app/subscriptions", {
			body: { url: "https://example.com/events" },
		})
		expect(get).toHaveBeenNthCalledWith(5, "/my%20app/notion/subscriptions")
		expect(post).toHaveBeenNthCalledWith(3, "/my%20app/notion/subscriptions", {
			body: { url: "https://example.com/notion" },
		})
		expect(del).toHaveBeenNthCalledWith(2, "/my%20app/subscriptions/sub_123")
		expect(del).toHaveBeenNthCalledWith(
			3,
			"/my%20app/notion/subscriptions/sub_456",
		)
	})

	test("lists trigger types through the MCP events extension", async () => {
		const request = vi.fn().mockResolvedValue({
			events: [{ name: "page.updated" }],
		})
		const close = vi.fn().mockResolvedValue(undefined)
		const session = new ConnectSession({} as never, "calclavia")
		session.getEventsClient = vi.fn().mockResolvedValue({ request, close })

		const result = await session.listEventTriggers("notion")

		expect(session.getEventsClient).toHaveBeenCalledWith("notion")
		expect(request).toHaveBeenCalledWith(
			{ method: "ai.smithery/events/list" },
			expect.anything(),
		)
		expect(result).toEqual([{ name: "page.updated" }])
		expect(close).toHaveBeenCalled()
	})
})
