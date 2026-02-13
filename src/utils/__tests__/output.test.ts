import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import {
	isJsonMode,
	outputDetail,
	outputJson,
	outputTable,
	setOutputMode,
	truncate,
} from "../output"

let consoleLogSpy: ReturnType<typeof vi.spyOn>

describe("output mode detection", () => {
	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
		// Reset global state between tests
		setOutputMode({})
	})

	test("--json flag forces JSON mode", () => {
		setOutputMode({ json: true })
		expect(isJsonMode()).toBe(true)
	})

	test("--table flag forces table mode", () => {
		setOutputMode({ table: true })
		expect(isJsonMode()).toBe(false)
	})

	test("--table takes precedence over --json", () => {
		setOutputMode({ json: true, table: true })
		expect(isJsonMode()).toBe(false)
	})

	test("json: false explicitly disables JSON mode", () => {
		setOutputMode({ json: false })
		expect(isJsonMode()).toBe(false)
	})

	test("falls back to TTY detection when no flags set", () => {
		setOutputMode({})
		// In test environment, isTTY is typically undefined (non-TTY)
		expect(isJsonMode()).toBe(!process.stdout.isTTY)
	})
})

describe("truncate", () => {
	test("returns short strings unchanged", () => {
		expect(truncate("hello")).toBe("hello")
	})

	test("truncates long strings with ellipsis", () => {
		const long = "a".repeat(100)
		const result = truncate(long, 20)
		expect(result.length).toBe(20)
		expect(result).toBe("a".repeat(19) + "\u2026")
	})

	test("handles exact length strings", () => {
		const exact = "a".repeat(60)
		expect(truncate(exact)).toBe(exact)
	})
})

describe("outputJson", () => {
	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
	})

	test("outputs compact JSON", () => {
		outputJson({ foo: "bar", count: 1 })
		expect(consoleLogSpy).toHaveBeenCalledWith('{"foo":"bar","count":1}')
	})

	test("handles arrays", () => {
		outputJson([1, 2, 3])
		expect(consoleLogSpy).toHaveBeenCalledWith("[1,2,3]")
	})

	test("handles null", () => {
		outputJson(null)
		expect(consoleLogSpy).toHaveBeenCalledWith("null")
	})
})

describe("outputDetail", () => {
	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
	})

	test("outputs JSON with tip as hint field", () => {
		outputDetail({
			data: { name: "test", value: 42 },
			json: true,
			tip: "Use --help for more info.",
		})

		const output = consoleLogSpy.mock.calls[0][0] as string
		const parsed = JSON.parse(output)
		expect(parsed).toEqual({
			name: "test",
			value: 42,
			hint: "Use --help for more info.",
		})
	})

	test("outputs JSON without tip", () => {
		outputDetail({
			data: { name: "test" },
			json: true,
		})

		const output = consoleLogSpy.mock.calls[0][0] as string
		const parsed = JSON.parse(output)
		expect(parsed).toEqual({ name: "test" })
	})

	test("renders key-value pairs in table mode", () => {
		outputDetail({
			data: { name: "test-server", status: "connected" },
			json: false,
		})

		// Should have called console.log for each key
		expect(consoleLogSpy).toHaveBeenCalledTimes(2)
	})

	test("skips null and undefined values in table mode", () => {
		outputDetail({
			data: { name: "test", empty: null, missing: undefined },
			json: false,
		})

		// Only "name" should be printed
		expect(consoleLogSpy).toHaveBeenCalledTimes(1)
	})
})

describe("outputTable", () => {
	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
	})

	test("outputs JSON with jsonData when in json mode", () => {
		outputTable({
			data: [{ name: "a" }],
			columns: [{ key: "name", header: "NAME" }],
			json: true,
			jsonData: { tools: [{ name: "a" }], total: 1 },
		})

		const output = consoleLogSpy.mock.calls[0][0] as string
		const parsed = JSON.parse(output)
		expect(parsed.tools).toEqual([{ name: "a" }])
		expect(parsed.total).toBe(1)
	})

	test("includes hint in JSON output", () => {
		outputTable({
			data: [],
			columns: [],
			json: true,
			tip: "No results found.",
		})

		const output = consoleLogSpy.mock.calls[0][0] as string
		const parsed = JSON.parse(output)
		expect(parsed.hint).toBe("No results found.")
	})

	test("includes pagination in JSON output", () => {
		outputTable({
			data: [{ name: "a" }],
			columns: [{ key: "name", header: "NAME" }],
			json: true,
			pagination: { page: 1, hasMore: true },
		})

		const output = consoleLogSpy.mock.calls[0][0] as string
		const parsed = JSON.parse(output)
		expect(parsed.pagination).toContain("--page 2")
	})

	test("wraps raw arrays in results key for JSON", () => {
		outputTable({
			data: [{ name: "a" }],
			columns: [{ key: "name", header: "NAME" }],
			json: true,
			// jsonData is array, should be wrapped
			jsonData: [{ name: "a" }],
		})

		const output = consoleLogSpy.mock.calls[0][0] as string
		const parsed = JSON.parse(output)
		expect(parsed.results).toEqual([{ name: "a" }])
	})

	test("shows tip for empty data in table mode", () => {
		outputTable({
			data: [],
			columns: [{ key: "name", header: "NAME" }],
			json: false,
			tip: "No servers found.",
		})

		expect(consoleLogSpy).toHaveBeenCalledTimes(1)
		expect(consoleLogSpy.mock.calls[0][0]).toContain("No servers found.")
	})

	test("renders rows without header for single row", () => {
		outputTable({
			data: [{ name: "test-server" }],
			columns: [{ key: "name", header: "NAME" }],
			json: false,
		})

		// Should only have 1 row (no header for single row)
		expect(consoleLogSpy).toHaveBeenCalledTimes(1)
		expect(consoleLogSpy.mock.calls[0][0]).toContain("test-server")
	})

	test("renders header + rows for multiple rows", () => {
		outputTable({
			data: [{ name: "server-a" }, { name: "server-b" }],
			columns: [{ key: "name", header: "NAME" }],
			json: false,
		})

		// header + 2 rows
		expect(consoleLogSpy).toHaveBeenCalledTimes(3)
	})

	test("applies column format function", () => {
		outputTable({
			data: [{ count: 1000 }],
			columns: [
				{
					key: "count",
					header: "COUNT",
					format: (v) => `${Number(v).toLocaleString()} items`,
				},
			],
			json: false,
		})

		expect(consoleLogSpy.mock.calls[0][0]).toContain("items")
	})
})
