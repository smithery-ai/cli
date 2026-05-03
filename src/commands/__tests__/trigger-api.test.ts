import { describe, expect, test, vi } from "vitest"
import { ConnectSession } from "../mcp/api"

describe("ConnectSession trigger support", () => {
	test("uses typed trigger resources aligned with the MCP Events spec", async () => {
		const listTriggers = vi.fn().mockResolvedValue([])
		const getTrigger = vi.fn().mockResolvedValue({ name: "page.updated" })
		const subscribeTrigger = vi.fn().mockResolvedValue({
			id: "sub_123",
			refreshBefore: "2026-05-02T12:00:00.000Z",
		})
		const unsubscribeTrigger = vi.fn().mockResolvedValue({ success: true })

		const session = new ConnectSession(
			{
				connections: {
					triggers: {
						list: listTriggers,
						get: getTrigger,
						subscribe: subscribeTrigger,
						unsubscribe: unsubscribeTrigger,
					},
				},
			} as never,
			"my app",
		)

		await session.listTriggers("notion")
		await session.getTrigger("notion", "page.updated")
		await session.subscribeTrigger(
			"notion",
			"page.updated",
			{ workspace_id: "w_123" },
			{
				url: "https://my-app.example.com/events",
				secret: "whsec_dGVzdF9zZWNyZXRfMjRfYnl0ZXNfbWluaW11bSE=",
			},
		)
		await session.unsubscribeTrigger(
			"notion",
			"page.updated",
			{ workspace_id: "w_123" },
			"https://my-app.example.com/events",
		)

		expect(listTriggers).toHaveBeenCalledWith("notion", {
			namespace: "my app",
		})
		expect(getTrigger).toHaveBeenCalledWith("page.updated", {
			namespace: "my app",
			connectionId: "notion",
		})
		expect(subscribeTrigger).toHaveBeenCalledWith("page.updated", {
			namespace: "my app",
			connectionId: "notion",
			delivery: {
				url: "https://my-app.example.com/events",
				secret: "whsec_dGVzdF9zZWNyZXRfMjRfYnl0ZXNfbWluaW11bSE=",
			},
			params: { workspace_id: "w_123" },
		})
		expect(unsubscribeTrigger).toHaveBeenCalledWith("page.updated", {
			namespace: "my app",
			connectionId: "notion",
			delivery: { url: "https://my-app.example.com/events" },
			params: { workspace_id: "w_123" },
		})
	})
})
