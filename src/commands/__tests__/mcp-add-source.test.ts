import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockCreateConnection,
	mockSetConnection,
	mockCreateSession,
	mockOutputConnectionDetail,
} = vi.hoisted(() => {
	const createConnection = vi.fn()
	const setConnection = vi.fn()
	const createSession = vi.fn(async () => ({
		createConnection,
		setConnection,
	}))

	return {
		mockCreateConnection: createConnection,
		mockSetConnection: setConnection,
		mockCreateSession: createSession,
		mockOutputConnectionDetail: vi.fn(),
	}
})

vi.mock("../mcp/api", () => ({
	ConnectSession: {
		create: mockCreateSession,
	},
	connectionTargetFromInput: (input: string) =>
		input.startsWith("http://") || input.startsWith("https://")
			? { mcpUrl: input }
			: { server: input },
}))

vi.mock("../mcp/output-connection", () => ({
	outputConnectionDetail: mockOutputConnectionDetail,
}))

import { addServer } from "../mcp/add"

describe("mcp add --source", () => {
	let cwd: string
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeEach(async () => {
		vi.clearAllMocks()
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		cwd = path.join(process.cwd(), ".context", "mcp-add-source")
		await rm(cwd, { recursive: true, force: true })
		await mkdir(cwd, { recursive: true })
		await writeFile(
			path.join(cwd, "support.ts"),
			"export function normalize(input: { text: string }): { text: string } { return input }\n",
		)
	})

	afterEach(async () => {
		consoleErrorSpy.mockRestore()
		await rm(cwd, { recursive: true, force: true })
	})

	test("sets a source-backed connection when an id is provided", async () => {
		mockSetConnection.mockResolvedValue({
			connectionId: "support",
			name: "Support tools",
			mcpUrl: "https://dynamic-mcp-module.smithery.internal/calclavia/support",
			metadata: { team: "support" },
			status: { state: "connected" },
		})

		await addServer(undefined, {
			id: "support",
			name: "Support tools",
			namespace: "calclavia",
			metadata: '{"team":"support"}',
			source: path.join(".context", "mcp-add-source", "support.ts"),
		})

		expect(mockCreateSession).toHaveBeenCalledWith("calclavia")
		expect(mockSetConnection).toHaveBeenCalledWith(
			"support",
			{
				source: {
					kind: "module",
					entrypoint: ".context/mcp-add-source/support.ts",
					sourceFiles: [
						{
							path: ".context/mcp-add-source/support.ts",
							contents:
								"export function normalize(input: { text: string }): { text: string } { return input }\n",
						},
					],
				},
			},
			{
				name: "Support tools",
				metadata: { team: "support" },
			},
		)
		expect(mockCreateConnection).not.toHaveBeenCalled()
		expect(mockOutputConnectionDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				connection: expect.objectContaining({ connectionId: "support" }),
				tip: "Use smithery tool list support to view tools.",
			}),
		)
	})

	test("creates a source-backed connection when no id is provided", async () => {
		mockCreateConnection.mockResolvedValue({
			connectionId: "support-tools",
			name: "Support tools",
			mcpUrl:
				"https://dynamic-mcp-module.smithery.internal/calclavia/support-tools",
			metadata: null,
			status: { state: "connected" },
		})

		await addServer(undefined, {
			name: "Support tools",
			source: path.join(".context", "mcp-add-source", "support.ts"),
		})

		expect(mockCreateConnection).toHaveBeenCalledWith(
			expect.objectContaining({
				source: expect.objectContaining({
					kind: "module",
					entrypoint: ".context/mcp-add-source/support.ts",
				}),
			}),
			{
				name: "Support tools",
				metadata: undefined,
			},
		)
		expect(mockSetConnection).not.toHaveBeenCalled()
	})

	test("defaults source-backed connection name to id", async () => {
		mockSetConnection.mockResolvedValue({
			connectionId: "support",
			name: "support",
			mcpUrl: "https://dynamic-mcp-module.smithery.internal/calclavia/support",
			metadata: null,
			status: { state: "connected" },
		})

		await addServer(undefined, {
			id: "support",
			source: path.join(".context", "mcp-add-source", "support.ts"),
		})

		expect(mockSetConnection).toHaveBeenCalledWith(
			"support",
			expect.any(Object),
			expect.objectContaining({
				name: "support",
			}),
		)
	})

	test("rejects unsupported source option combinations", async () => {
		await expect(
			addServer("github", {
				source: path.join(".context", "mcp-add-source", "support.ts"),
			}),
		).rejects.toThrow("process.exit() was called")

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"--source cannot be used with a server argument.",
			),
		)
		expect(mockCreateConnection).not.toHaveBeenCalled()
		expect(mockSetConnection).not.toHaveBeenCalled()
	})

	test.each([
		{
			options: { headers: '{"x-api-key":"secret"}' },
			message: "--headers is not supported for source-backed connections.",
		},
		{
			options: { config: "{}" },
			message: "--config is not supported for source-backed connections.",
		},
		{
			options: { force: true },
			message: "--force is not supported for source-backed connections.",
		},
		{
			options: { uplinkCommand: ["node", "server.js"] },
			message: "--source cannot be used with a local command.",
		},
	])("rejects $message", async ({ options, message }) => {
		await expect(
			addServer(undefined, {
				...options,
				source: path.join(".context", "mcp-add-source", "support.ts"),
			}),
		).rejects.toThrow("process.exit() was called")

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(message),
		)
		expect(mockCreateConnection).not.toHaveBeenCalled()
		expect(mockSetConnection).not.toHaveBeenCalled()
	})
})
