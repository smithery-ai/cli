import { exec } from "node:child_process"
import inquirer from "inquirer"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import yoctoSpinner from "yocto-spinner"

vi.mock("node:child_process", () => ({
	exec: vi.fn((_command, callback) => callback(null, "", "")),
}))

vi.mock("inquirer", () => ({
	default: {
		prompt: vi.fn(),
	},
}))

vi.mock("yocto-spinner", () => ({
	default: vi.fn(() => ({
		start: vi.fn().mockReturnThis(),
		success: vi.fn().mockReturnThis(),
		error: vi.fn().mockReturnThis(),
		stop: vi.fn().mockReturnThis(),
	})),
}))

const originalIsTTY = process.stdin.isTTY

function setIsTTY(value: boolean) {
	Object.defineProperty(process.stdin, "isTTY", {
		configurable: true,
		value,
	})
}

function mockFetchResponses(responses: unknown[]) {
	const fetchMock = vi.fn()
	for (const response of responses) {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: vi.fn().mockResolvedValue(response),
			text: vi.fn().mockResolvedValue(JSON.stringify(response)),
		})
	}
	vi.stubGlobal("fetch", fetchMock)
	return fetchMock
}

describe("executeCliAuthFlow", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => {
		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: originalIsTTY,
		})
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	test("passes organization option when creating auth session", async () => {
		setIsTTY(false)
		const fetchMock = mockFetchResponses([
			{
				sessionId: "session-1",
				authUrl: "https://smithery.ai/auth/cli?s=session-1",
			},
			{
				status: "success",
				apiKey: "smy_test",
				organization: { id: "org_123", name: "Acme" },
				namespace: "acme",
			},
		])

		const { executeCliAuthFlow } = await import("../cli-auth")
		const result = await executeCliAuthFlow({
			organization: "org_123",
			pollInterval: 1,
			timeoutMs: 50,
		})

		expect(result).toEqual({
			apiKey: "smy_test",
			organization: { id: "org_123", name: "Acme" },
			namespace: "acme",
		})
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			"https://smithery.ai/api/auth/cli/session",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ organizationId: "org_123" }),
			},
		)
		expect(console.log).toHaveBeenCalledWith(
			JSON.stringify({
				auth_url:
					"https://smithery.ai/auth/cli?s=session-1&organization_id=org_123",
				session_id: "session-1",
			}),
		)
	})

	test("prompts and submits organization selection when poll requires it", async () => {
		setIsTTY(true)
		vi.mocked(inquirer.prompt).mockResolvedValue({ organizationId: "org_456" })
		const fetchMock = mockFetchResponses([
			{
				sessionId: "session-2",
				authUrl: "https://smithery.ai/auth/cli?s=session-2",
			},
			{
				status: "organization_selection_required",
				organizations: [
					{ id: "org_123", name: "Personal" },
					{ id: "org_456", name: "Team" },
				],
			},
			{
				status: "success",
				apiKey: "smy_team",
				organization: { id: "org_456", name: "Team", namespace: "team" },
			},
		])

		const { executeCliAuthFlow } = await import("../cli-auth")
		const result = await executeCliAuthFlow({ pollInterval: 1, timeoutMs: 50 })

		expect(result).toEqual({
			apiKey: "smy_team",
			organization: { id: "org_456", name: "Team", namespace: "team" },
			namespace: "team",
		})
		expect(inquirer.prompt).toHaveBeenCalledWith([
			expect.objectContaining({
				type: "list",
				name: "organizationId",
				message: "Select organization:",
			}),
		])
		expect(fetchMock).toHaveBeenNthCalledWith(
			3,
			"https://smithery.ai/api/auth/cli/session/session-2/organization",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ organizationId: "org_456" }),
			},
		)
		expect(yoctoSpinner).toHaveBeenCalled()
		expect(exec).toHaveBeenCalled()
	})
})
