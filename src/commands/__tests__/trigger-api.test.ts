import { describe, expect, test, vi } from "vitest"
import { ConnectSession } from "../mcp/api"

describe("ConnectSession trigger support", () => {
	test("uses typed trigger and subscription resources", async () => {
		const listTriggers = vi.fn().mockResolvedValue([])
		const getTrigger = vi.fn().mockResolvedValue({ name: "page.updated" })
		const createTrigger = vi.fn().mockResolvedValue({ id: "trg_123" })
		const getTriggerInstance = vi.fn().mockResolvedValue({ id: "trg_123" })
		const deleteTrigger = vi.fn().mockResolvedValue({ success: true })
		const listNamespaceSubscriptions = vi.fn().mockResolvedValue([])
		const createNamespaceSubscription = vi.fn().mockResolvedValue({
			id: "sub_123",
		})
		const deleteNamespaceSubscription = vi.fn().mockResolvedValue({
			success: true,
		})
		const listConnectionSubscriptions = vi.fn().mockResolvedValue([])
		const createConnectionSubscription = vi.fn().mockResolvedValue({
			id: "sub_456",
		})
		const deleteConnectionSubscription = vi.fn().mockResolvedValue({
			success: true,
		})

		const session = new ConnectSession(
			{
				connections: {
					triggers: {
						list: listTriggers,
						get: getTrigger,
						create: createTrigger,
						getInstance: getTriggerInstance,
						delete: deleteTrigger,
					},
					subscriptions: {
						list: listConnectionSubscriptions,
						create: createConnectionSubscription,
						delete: deleteConnectionSubscription,
					},
				},
				subscriptions: {
					list: listNamespaceSubscriptions,
					create: createNamespaceSubscription,
					delete: deleteNamespaceSubscription,
				},
			} as never,
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

		expect(listTriggers).toHaveBeenCalledWith("notion", {
			namespace: "my app",
		})
		expect(getTrigger).toHaveBeenCalledWith("page.updated", {
			namespace: "my app",
			connectionId: "notion",
		})
		expect(createTrigger).toHaveBeenCalledWith(
			"page.updated",
			{
				namespace: "my app",
				connectionId: "notion",
			},
			{
				body: { params: { workspace_id: "w_123" } },
			},
		)
		expect(getTriggerInstance).toHaveBeenCalledWith("trg_123", {
			namespace: "my app",
			connectionId: "notion",
			triggerName: "page.updated",
		})
		expect(deleteTrigger).toHaveBeenCalledWith("trg_123", {
			namespace: "my app",
			connectionId: "notion",
			triggerName: "page.updated",
		})
		expect(listNamespaceSubscriptions).toHaveBeenCalledWith("my app")
		expect(createNamespaceSubscription).toHaveBeenCalledWith("my app", {
			body: { url: "https://example.com/events" },
		})
		expect(listConnectionSubscriptions).toHaveBeenCalledWith("notion", {
			namespace: "my app",
		})
		expect(createConnectionSubscription).toHaveBeenCalledWith(
			"notion",
			{
				namespace: "my app",
			},
			{
				body: { url: "https://example.com/notion" },
			},
		)
		expect(deleteNamespaceSubscription).toHaveBeenCalledWith("sub_123", {
			namespace: "my app",
		})
		expect(deleteConnectionSubscription).toHaveBeenCalledWith("sub_456", {
			namespace: "my app",
			connectionId: "notion",
		})
	})
})
