import pc from "picocolors"
import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock dependencies
vi.mock("../../../lib/smithery-client", () => ({
	createSmitheryClient: vi.fn(),
}))

vi.mock("../../../utils/smithery-settings", () => ({
	setNamespace: vi.fn(),
}))

import { createSmitheryClient } from "../../../lib/smithery-client"
import { setNamespace } from "../../../utils/smithery-settings"
import { useNamespace } from "../use"

describe("useNamespace", () => {
	let mockClient: {
		namespaces: {
			list: ReturnType<typeof vi.fn>
		}
	}
	let consoleLogSpy: any
	let consoleErrorSpy: any
	let processExitSpy: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockClient = {
			namespaces: {
				list: vi.fn(),
			},
		}

		vi.mocked(createSmitheryClient).mockResolvedValue(
			mockClient as unknown as Awaited<ReturnType<typeof createSmitheryClient>>,
		)

		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
			throw new Error("process.exit called")
		}) as never)
	})

	test("successfully switches to existing namespace", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [
				{ name: "personal" },
				{ name: "team-alpha" },
				{ name: "team-beta" },
			],
		})
		vi.mocked(setNamespace).mockResolvedValue({
			success: true,
		})

		await useNamespace("team-alpha")

		expect(mockClient.namespaces.list).toHaveBeenCalledOnce()
		expect(setNamespace).toHaveBeenCalledWith("team-alpha")
		expect(consoleLogSpy).toHaveBeenCalledWith(
			pc.green("Switched to namespace: team-alpha"),
		)
		expect(processExitSpy).not.toHaveBeenCalled()
	})

	test("fails when namespace does not exist", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "personal" }, { name: "team-alpha" }],
		})

		await expect(useNamespace("nonexistent")).rejects.toThrow(
			"process.exit called",
		)

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			pc.red('Namespace "nonexistent" not found.'),
		)
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			pc.gray("Available namespaces: personal, team-alpha"),
		)
		expect(setNamespace).not.toHaveBeenCalled()
		expect(processExitSpy).toHaveBeenCalledWith(1)
	})

	test("handles save failure", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "personal" }],
		})
		vi.mocked(setNamespace).mockResolvedValue({
			success: false,
			error: "Permission denied",
		})

		await expect(useNamespace("personal")).rejects.toThrow(
			"process.exit called",
		)

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			pc.red("Failed to save namespace setting."),
		)
		expect(consoleErrorSpy).toHaveBeenCalledWith(pc.gray("Permission denied"))
		expect(processExitSpy).toHaveBeenCalledWith(1)
	})

	test("handles API error when listing namespaces", async () => {
		mockClient.namespaces.list.mockRejectedValue(new Error("Network error"))

		await expect(useNamespace("any-namespace")).rejects.toThrow("Network error")

		expect(setNamespace).not.toHaveBeenCalled()
		expect(processExitSpy).not.toHaveBeenCalled()
	})

	test("lists available namespaces when target not found", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [
				{ name: "ns1" },
				{ name: "ns2" },
				{ name: "ns3" },
				{ name: "ns4" },
			],
		})

		await expect(useNamespace("wrong")).rejects.toThrow("process.exit called")

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			pc.gray("Available namespaces: ns1, ns2, ns3, ns4"),
		)
	})
})
