import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const { mockCreateSession, mockCallTool, mockOutputJson } = vi.hoisted(() => {
	const callTool = vi.fn()
	const createSession = vi.fn(async () => ({
		callTool,
	}))

	return {
		mockCreateSession: createSession,
		mockCallTool: callTool,
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
		outputJson: mockOutputJson,
	}
})

import { setOutputMode } from "../../utils/output"
import { callTool } from "../mcp/call"

// Capture console output
let consoleLogSpy: ReturnType<typeof vi.spyOn>
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

describe("tool call command", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
		consoleErrorSpy.mockRestore()
	})

	describe("formatToolResult (via callTool in table mode)", () => {
		beforeEach(() => {
			setOutputMode({ table: true })
		})

		test("extracts text from single text content block", async () => {
			mockCallTool.mockResolvedValue({
				content: [{ type: "text", text: "Hello, world!" }],
			})

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith("Hello, world!")
		})

		test("concatenates multiple text content blocks with newlines", async () => {
			mockCallTool.mockResolvedValue({
				content: [
					{ type: "text", text: "Line 1" },
					{ type: "text", text: "Line 2" },
					{ type: "text", text: "Line 3" },
				],
			})

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith("Line 1\nLine 2\nLine 3")
		})

		test("prefers structuredContent over content array", async () => {
			mockCallTool.mockResolvedValue({
				structuredContent: { foo: "bar", count: 42 },
				content: [{ type: "text", text: "ignored" }],
			})

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith(
				JSON.stringify({ foo: "bar", count: 42 }),
			)
		})

		test("handles image content blocks", async () => {
			mockCallTool.mockResolvedValue({
				content: [{ type: "image", mimeType: "image/png", data: "..." }],
			})

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith("[image: image/png]")
		})

		test("handles audio content blocks", async () => {
			mockCallTool.mockResolvedValue({
				content: [{ type: "audio", mimeType: "audio/wav", data: "..." }],
			})

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith("[audio: audio/wav]")
		})

		test("handles resource content blocks with text", async () => {
			mockCallTool.mockResolvedValue({
				content: [
					{
						type: "resource",
						resource: {
							uri: "file:///readme.md",
							text: "# README",
						},
					},
				],
			})

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith("# README")
		})

		test("handles resource content blocks without text", async () => {
			mockCallTool.mockResolvedValue({
				content: [
					{
						type: "resource",
						resource: { uri: "file:///image.png", blob: "..." },
					},
				],
			})

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[resource: file:///image.png]",
			)
		})

		test("handles resource_link content blocks", async () => {
			mockCallTool.mockResolvedValue({
				content: [{ type: "resource_link", uri: "file:///data.csv" }],
			})

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[resource_link: file:///data.csv]",
			)
		})

		test("handles mixed content types", async () => {
			mockCallTool.mockResolvedValue({
				content: [
					{ type: "text", text: "Results:" },
					{ type: "image", mimeType: "image/jpeg" },
					{ type: "text", text: "Done." },
				],
			})

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"Results:\n[image: image/jpeg]\nDone.",
			)
		})

		test("returns empty string for empty content array", async () => {
			mockCallTool.mockResolvedValue({ content: [] })

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith("")
		})

		test("returns empty string for missing content", async () => {
			mockCallTool.mockResolvedValue({})

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith("")
		})

		test("exits with error when isError is true", async () => {
			mockCallTool.mockResolvedValue({
				content: [{ type: "text", text: "Something went wrong" }],
				isError: true,
			})

			await expect(callTool("conn", "tool", undefined, {})).rejects.toThrow(
				"process.exit",
			)

			expect(consoleErrorSpy).toHaveBeenCalledWith("Something went wrong")
		})

		test("skips non-object content blocks gracefully", async () => {
			mockCallTool.mockResolvedValue({
				content: [null, "not an object", { type: "text", text: "valid" }],
			})

			await callTool("conn", "tool", undefined, {})

			expect(consoleLogSpy).toHaveBeenCalledWith("valid")
		})
	})

	describe("JSON mode passthrough", () => {
		beforeEach(() => {
			setOutputMode({ json: true })
		})

		test("passes full MCP response as JSON", async () => {
			const mcpResponse = {
				content: [{ type: "text", text: "hello" }],
				_meta: {},
				isError: false,
			}
			mockCallTool.mockResolvedValue(mcpResponse)

			await callTool("conn", "tool", undefined, {})

			expect(mockOutputJson).toHaveBeenCalledWith(mcpResponse)
			expect(consoleLogSpy).not.toHaveBeenCalled()
		})
	})

	describe("argument parsing", () => {
		beforeEach(() => {
			setOutputMode({ json: true })
		})

		test("parses valid JSON args", async () => {
			mockCallTool.mockResolvedValue({ content: [] })

			await callTool("conn", "tool", '{"key": "value"}', {})

			expect(mockCallTool).toHaveBeenCalledWith("conn", "tool", {
				key: "value",
			})
		})

		test("calls with empty args when no args provided", async () => {
			mockCallTool.mockResolvedValue({ content: [] })

			await callTool("conn", "tool", undefined, {})

			expect(mockCallTool).toHaveBeenCalledWith("conn", "tool", {})
		})

		test("exits with error for invalid JSON args", async () => {
			await expect(callTool("conn", "tool", "not json", {})).rejects.toThrow(
				"process.exit",
			)

			expect(mockOutputJson).toHaveBeenCalledWith(
				expect.objectContaining({
					result: null,
					isError: true,
					error: expect.stringContaining("Invalid JSON args"),
				}),
			)
		})
	})

	describe("connection errors", () => {
		beforeEach(() => {
			setOutputMode({ json: true })
		})

		test("outputs error JSON when session call fails", async () => {
			mockCallTool.mockRejectedValue(new Error("Connection refused"))

			await expect(callTool("conn", "tool", undefined, {})).rejects.toThrow(
				"process.exit",
			)

			expect(mockOutputJson).toHaveBeenCalledWith(
				expect.objectContaining({
					result: null,
					isError: true,
					error: "Connection refused",
				}),
			)
		})

		test("passes namespace to session creation", async () => {
			mockCallTool.mockResolvedValue({ content: [] })

			await callTool("conn", "tool", undefined, { namespace: "my-ns" })

			expect(mockCreateSession).toHaveBeenCalledWith("my-ns")
		})
	})
})
