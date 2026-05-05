import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock dependencies
vi.mock("../../../lib/smithery-client", () => ({
	createSmitheryClient: vi.fn(),
}))

vi.mock("../../../utils/smithery-settings", () => ({
	getNamespace: vi.fn(),
}))

vi.mock("../../../utils/output", () => ({
	isJsonMode: vi.fn(),
	outputTable: vi.fn(),
}))

import { createSmitheryClient } from "../../../lib/smithery-client"
import { isJsonMode, outputTable } from "../../../utils/output"
import { getNamespace } from "../../../utils/smithery-settings"
import { listNamespaces } from "../list"

describe("listNamespaces", () => {
	let mockClient: {
		namespaces: {
			list: ReturnType<typeof vi.fn>
		}
	}

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
		vi.mocked(isJsonMode).mockReturnValue(false)
	})

	test("lists namespaces with current marker", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [
				{ name: "personal" },
				{ name: "team-alpha" },
				{ name: "team-beta" },
			],
		})
		vi.mocked(getNamespace).mockResolvedValue("team-alpha")

		await listNamespaces()

		expect(mockClient.namespaces.list).toHaveBeenCalledOnce()
		expect(getNamespace).toHaveBeenCalledOnce()
		expect(outputTable).toHaveBeenCalledWith({
			data: [
				{ name: "personal", current: "" },
				{ name: "team-alpha", current: "✓" },
				{ name: "team-beta", current: "" },
			],
			columns: [
				{ key: "name", header: "NAME" },
				{ key: "current", header: "CURRENT" },
			],
			json: false,
			jsonData: {
				namespaces: ["personal", "team-alpha", "team-beta"],
				current: "team-alpha",
			},
			tip: "Use smithery namespace use <name> to switch namespaces.",
		})
	})

	test("handles no current namespace", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "personal" }, { name: "team-alpha" }],
		})
		vi.mocked(getNamespace).mockResolvedValue(undefined)

		await listNamespaces()

		expect(outputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					{ name: "personal", current: "" },
					{ name: "team-alpha", current: "" },
				],
				jsonData: {
					namespaces: ["personal", "team-alpha"],
					current: null,
				},
			}),
		)
	})

	test("handles empty namespace list", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [],
		})
		vi.mocked(getNamespace).mockResolvedValue(undefined)

		await listNamespaces()

		expect(outputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [],
				jsonData: {
					namespaces: [],
					current: null,
				},
			}),
		)
	})

	test("handles JSON output mode", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "ns1" }, { name: "ns2" }],
		})
		vi.mocked(getNamespace).mockResolvedValue("ns1")
		vi.mocked(isJsonMode).mockReturnValue(true)

		await listNamespaces()

		expect(outputTable).toHaveBeenCalledWith(
			expect.objectContaining({
				json: true,
			}),
		)
	})

	test("handles API error", async () => {
		mockClient.namespaces.list.mockRejectedValue(new Error("API error"))

		await expect(listNamespaces()).rejects.toThrow("API error")

		expect(outputTable).not.toHaveBeenCalled()
	})

	test("marks current namespace correctly in large list", async () => {
		const namespaces = Array.from({ length: 10 }, (_, i) => ({
			name: `namespace-${i}`,
		}))
		mockClient.namespaces.list.mockResolvedValue({ namespaces })
		vi.mocked(getNamespace).mockResolvedValue("namespace-5")

		await listNamespaces()

		const callArg = vi.mocked(outputTable).mock.calls[0][0]
		const data = callArg.data as Array<{ name: string; current: string }>

		expect(data.find((d) => d.name === "namespace-5")?.current).toBe("✓")
		expect(data.filter((d) => d.current === "✓")).toHaveLength(1)
	})
})
