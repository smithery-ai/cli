import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockAddServerImpl,
	mockCreateConnection,
	mockSetConnection,
	mockCreateSession,
	mockServeUplink,
} = vi.hoisted(() => {
	const addServerImpl = vi.fn()
	const createConnection = vi.fn()
	const setConnection = vi.fn()
	const createSession = vi.fn(async () => ({
		createConnection,
		setConnection,
		getNamespace: () => "calclavia",
	}))
	const serveUplink = vi.fn(async () => 0)

	return {
		mockAddServerImpl: addServerImpl,
		mockCreateConnection: createConnection,
		mockSetConnection: setConnection,
		mockCreateSession: createSession,
		mockServeUplink: serveUplink,
	}
})

vi.mock("../mcp/add-impl", () => ({
	addServer: mockAddServerImpl,
}))

vi.mock("../mcp/api", () => ({
	ConnectSession: {
		create: mockCreateSession,
	},
}))

vi.mock("../../lib/uplink", async () => {
	const actual = await vi.importActual("../../lib/uplink")
	return {
		...actual,
		serveUplink: mockServeUplink,
	}
})

import { addServer } from "../mcp/add"

describe("mcp add uplink routing", () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		vi.clearAllMocks()
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
		consoleErrorSpy.mockRestore()
	})

	test("upserts localhost URLs as uplink connections", async () => {
		mockSetConnection.mockResolvedValue({
			connectionId: "chrome",
			name: "chrome",
			transport: "uplink",
			mcpUrl: null,
			metadata: null,
			status: { state: "disconnected" },
		})

		await addServer("http://127.0.0.1:9090/mcp", {
			id: "chrome",
		})

		expect(mockSetConnection).toHaveBeenCalledWith("chrome", undefined, {
			name: "chrome",
			metadata: undefined,
			transport: "uplink",
		})
		expect(mockServeUplink).toHaveBeenCalledWith({
			connectionId: "chrome",
			force: undefined,
			namespace: "calclavia",
			target: {
				kind: "uplink-http",
				mcpUrl: "http://127.0.0.1:9090/mcp",
			},
		})
		expect(mockAddServerImpl).not.toHaveBeenCalled()
	})

	test("creates stdio uplink connections from commands passed after --", async () => {
		mockCreateConnection.mockResolvedValue({
			connectionId: "uplink-1",
			name: "uplink-1",
			transport: "uplink",
			mcpUrl: null,
			metadata: null,
			status: { state: "disconnected" },
		})

		await addServer(undefined, {
			uplinkCommand: ["npx", "-y", "@chromedevtools/chrome-devtools-mcp"],
		} as never)

		expect(mockCreateConnection).toHaveBeenCalledWith(undefined, {
			name: undefined,
			metadata: undefined,
			transport: "uplink",
		})
		expect(mockServeUplink).toHaveBeenCalledWith({
			connectionId: "uplink-1",
			force: undefined,
			namespace: "calclavia",
			target: {
				kind: "uplink-stdio",
				command: "npx",
				args: ["-y", "@chromedevtools/chrome-devtools-mcp"],
			},
		})
		expect(mockAddServerImpl).not.toHaveBeenCalled()
	})

	test("rejects headers for uplink targets before hitting the api", async () => {
		await expect(
			addServer("http://127.0.0.1:9090/mcp", {
				headers: '{"authorization":"Bearer nope"}',
			}),
		).rejects.toThrow("process.exit() was called")

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"--headers is not supported for uplink connections.",
			),
		)
		expect(mockCreateConnection).not.toHaveBeenCalled()
		expect(mockSetConnection).not.toHaveBeenCalled()
		expect(mockServeUplink).not.toHaveBeenCalled()
	})
})
