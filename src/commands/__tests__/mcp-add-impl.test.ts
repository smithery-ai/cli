import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockListConnectionsByUrl,
	mockCreateConnection,
	mockGetConnection,
	mockCreateSession,
	mockOutputConnectionDetail,
	mockExecFile,
} = vi.hoisted(() => {
	const listConnectionsByUrl = vi.fn()
	const createConnection = vi.fn()
	const getConnection = vi.fn()
	const execFile = vi.fn((_file, _args, callback) => callback(null))
	const createSession = vi.fn(async () => ({
		listConnectionsByUrl,
		createConnection,
		getConnection,
	}))

	return {
		mockListConnectionsByUrl: listConnectionsByUrl,
		mockCreateConnection: createConnection,
		mockGetConnection: getConnection,
		mockCreateSession: createSession,
		mockOutputConnectionDetail: vi.fn(),
		mockExecFile: execFile,
	}
})

vi.mock("node:child_process", () => ({
	execFile: mockExecFile,
}))

vi.mock("../mcp/api", () => ({
	ConnectSession: {
		create: mockCreateSession,
	},
}))

vi.mock("../mcp/output-connection", () => ({
	outputConnectionDetail: mockOutputConnectionDetail,
}))

import { addServer } from "../mcp/add-impl"

describe("mcp add duplicate handling", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>
	const originalStdinTTY = process.stdin.isTTY
	const originalStdoutTTY = process.stdout.isTTY

	beforeEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		process.stdin.isTTY = originalStdinTTY
		process.stdout.isTTY = originalStdoutTTY
	})

	afterEach(() => {
		consoleErrorSpy.mockRestore()
		vi.useRealTimers()
		process.stdin.isTTY = originalStdinTTY
		process.stdout.isTTY = originalStdoutTTY
	})

	test("shows a remove and re-add hint for unresolved duplicate connections", async () => {
		mockListConnectionsByUrl.mockResolvedValue({
			connections: [
				{
					connectionId: "test-input-required-two",
					name: "test-input-required-two",
					mcpUrl:
						"https://server.smithery.ai/calclavia/test-input-required-two",
					metadata: null,
					status: {
						state: "input_required",
						http: {
							headers: {
								"x-api-key": {
									label: "API Key",
									required: true,
								},
							},
							query: {
								projectId: {
									label: "Project ID",
									required: true,
								},
							},
						},
						missing: {
							headers: ["x-api-key"],
							query: ["projectId"],
						},
					},
				},
			],
		})

		await addServer("calclavia/test-input-required-two", {})

		expect(mockCreateConnection).not.toHaveBeenCalled()
		expect(mockOutputConnectionDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				connection: expect.objectContaining({
					connectionId: "test-input-required-two",
				}),
				tip: expect.stringContaining(
					"smithery mcp remove test-input-required-two",
				),
			}),
		)
	})

	test("prints setupUrl for auth_required duplicate connections", async () => {
		mockListConnectionsByUrl.mockResolvedValue({
			connections: [
				{
					connectionId: "github-oauth",
					name: "github-oauth",
					mcpUrl: "https://server.smithery.ai/github",
					metadata: null,
					status: {
						state: "auth_required",
						setupUrl: "https://smithery.ai/setup/github",
					},
				},
			],
		})

		await addServer("https://server.smithery.ai/github", {})

		expect(mockCreateConnection).not.toHaveBeenCalled()
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'Authorization required. Run: open "https://smithery.ai/setup/github"',
			),
		)
		expect(mockOutputConnectionDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				tip: "Use the setup URL above to complete setup.",
			}),
		)
	})

	test("opens setupUrl and waits for auth completion in TTY mode", async () => {
		vi.useFakeTimers()
		process.stdin.isTTY = true
		process.stdout.isTTY = true
		const setupUrl = "https://smithery.ai/setup/github"
		const createdConnection = {
			connectionId: "github-oauth",
			name: "github-oauth",
			mcpUrl: "https://server.smithery.ai/github",
			metadata: null,
			status: {
				state: "auth_required",
				setupUrl,
			},
		}
		const connectedConnection = {
			...createdConnection,
			status: {
				state: "connected",
			},
		}
		mockListConnectionsByUrl.mockResolvedValue({ connections: [] })
		mockCreateConnection.mockResolvedValue(createdConnection)
		mockGetConnection
			.mockResolvedValueOnce(createdConnection)
			.mockResolvedValueOnce(connectedConnection)

		const addPromise = addServer("https://server.smithery.ai/github", {})
		await vi.advanceTimersByTimeAsync(6000)
		await addPromise

		expect(mockExecFile).toHaveBeenCalledWith(
			expect.any(String),
			expect.arrayContaining([setupUrl]),
			expect.any(Function),
		)
		expect(mockGetConnection).toHaveBeenCalledTimes(2)
		expect(mockGetConnection).toHaveBeenCalledWith("github-oauth")
		expect(mockOutputConnectionDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				connection: connectedConnection,
			}),
		)
	})
})
