import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockAddServerImpl,
	mockCreateConnection,
	mockSetConnection,
	mockDeleteConnection,
	mockCreateSession,
	mockServeUplink,
	mockResolveServer,
	mockAddBundleUplinkServer,
} = vi.hoisted(() => {
	const addServerImpl = vi.fn()
	const createConnection = vi.fn()
	const setConnection = vi.fn()
	const deleteConnection = vi.fn(async () => {})
	const createSession = vi.fn(async () => ({
		createConnection,
		setConnection,
		deleteConnection,
		getNamespace: () => "calclavia",
	}))
	const serveUplink = vi.fn(async () => 0)
	const resolveServer = vi.fn()
	const addBundleUplinkServer = vi.fn(async () => {})

	return {
		mockAddServerImpl: addServerImpl,
		mockCreateConnection: createConnection,
		mockSetConnection: setConnection,
		mockDeleteConnection: deleteConnection,
		mockCreateSession: createSession,
		mockServeUplink: serveUplink,
		mockResolveServer: resolveServer,
		mockAddBundleUplinkServer: addBundleUplinkServer,
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

vi.mock("../../lib/registry", () => ({
	resolveServer: mockResolveServer,
}))

vi.mock("../mcp/add-uplink-bundle", () => ({
	addBundleUplinkServer: mockAddBundleUplinkServer,
}))

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
		expect(mockDeleteConnection).toHaveBeenCalledWith("chrome")
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
		expect(mockDeleteConnection).toHaveBeenCalledWith("uplink-1")
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

	test("routes a registry server with bundleUrl to the bundle uplink path", async () => {
		const stdioConnection = {
			type: "stdio" as const,
			configSchema: {},
			bundleUrl: "https://cdn.smithery.ai/bundles/foo.mcpb",
		}
		mockResolveServer.mockResolvedValue({
			server: { qualifiedName: "acme/foo" },
			connection: stdioConnection,
		})

		await addServer("acme/foo", { id: "my-foo" })

		expect(mockAddBundleUplinkServer).toHaveBeenCalledWith(
			{
				qualifiedName: "acme/foo",
				bundleUrl: "https://cdn.smithery.ai/bundles/foo.mcpb",
				connection: stdioConnection,
				server: { qualifiedName: "acme/foo" },
			},
			{ id: "my-foo" },
		)
		expect(mockAddServerImpl).not.toHaveBeenCalled()
		expect(mockServeUplink).not.toHaveBeenCalled()
	})

	test("falls through to the http flow when registry returns an http connection", async () => {
		mockResolveServer.mockResolvedValue({
			server: { qualifiedName: "acme/bar" },
			connection: {
				type: "http",
				configSchema: {},
				deploymentUrl: "https://bar.example.com/mcp",
			},
		})

		await addServer("acme/bar", {})

		expect(mockAddBundleUplinkServer).not.toHaveBeenCalled()
		expect(mockAddServerImpl).toHaveBeenCalledWith(
			"acme/bar",
			expect.objectContaining({ name: undefined }),
		)
	})

	test("falls through when registry returns a stdio connection without bundleUrl", async () => {
		mockResolveServer.mockResolvedValue({
			server: { qualifiedName: "acme/legacy" },
			connection: {
				type: "stdio",
				configSchema: {},
				stdioFunction: "() => ({ command: 'node' })",
			},
		})

		await addServer("acme/legacy", {})

		expect(mockAddBundleUplinkServer).not.toHaveBeenCalled()
		expect(mockAddServerImpl).toHaveBeenCalledWith(
			"acme/legacy",
			expect.objectContaining({ name: undefined }),
		)
	})

	test("falls through when registry resolution fails", async () => {
		mockResolveServer.mockRejectedValue(new Error("server not found"))

		await addServer("acme/unknown", {})

		expect(mockAddBundleUplinkServer).not.toHaveBeenCalled()
		expect(mockAddServerImpl).toHaveBeenCalledWith(
			"acme/unknown",
			expect.objectContaining({ name: undefined }),
		)
	})

	test("skips the registry probe for explicit http urls", async () => {
		await addServer("https://server.smithery.ai/exa", {})

		expect(mockResolveServer).not.toHaveBeenCalled()
		expect(mockAddBundleUplinkServer).not.toHaveBeenCalled()
		expect(mockAddServerImpl).toHaveBeenCalledWith(
			"https://server.smithery.ai/exa",
			expect.objectContaining({ name: undefined }),
		)
	})
})
