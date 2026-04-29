import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockCreateSession,
	mockDeleteConnection,
	mockEnsureBundleInstalled,
	mockGetHydratedBundleCommand,
	mockResolveUserConfig,
	mockServeUplink,
} = vi.hoisted(() => {
	const deleteConnection = vi.fn(async () => {})
	const createSession = vi.fn(async () => ({
		setConnection: vi.fn(async () => ({
			connectionId: "bundle-conn",
			name: "bundle-conn",
			transport: "uplink",
			mcpUrl: null,
			metadata: null,
			status: { state: "disconnected" },
		})),
		createConnection: vi.fn(),
		deleteConnection,
		getNamespace: () => "calclavia",
	}))

	return {
		mockCreateSession: createSession,
		mockDeleteConnection: deleteConnection,
		mockEnsureBundleInstalled: vi.fn(),
		mockGetHydratedBundleCommand: vi.fn(),
		mockResolveUserConfig: vi.fn(),
		mockServeUplink: vi.fn(async (_options: { onInterrupt?: () => void }) => 0),
	}
})

vi.mock("../../lib/keychain", () => ({
	saveConfig: vi.fn(async () => {}),
}))

vi.mock("../../lib/logger", () => ({
	verbose: vi.fn(),
}))

vi.mock("../../lib/mcpb", () => ({
	ensureBundleInstalled: mockEnsureBundleInstalled,
	getHydratedBundleCommand: mockGetHydratedBundleCommand,
}))

vi.mock("../../utils/install/user-config", () => ({
	resolveUserConfig: mockResolveUserConfig,
}))

vi.mock("../../utils/spinner", () => ({
	createSpinner: () => ({
		success: vi.fn(),
		error: vi.fn(),
	}),
}))

vi.mock("../mcp/api", () => ({
	ConnectSession: {
		create: mockCreateSession,
	},
}))

vi.mock("../../lib/uplink", () => ({
	serveUplink: mockServeUplink,
}))

import { addBundleUplinkServer } from "../mcp/add-uplink-bundle"

describe("mcp add bundle uplink", () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		vi.clearAllMocks()
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		mockResolveUserConfig.mockResolvedValue({})
		mockEnsureBundleInstalled.mockResolvedValue("/tmp/acme-foo")
		mockGetHydratedBundleCommand.mockReturnValue({
			command: "node",
			args: ["server.js"],
			env: { FOO: "bar" },
		})
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
	})

	test("keeps the uplink connection after the bundle server exits", async () => {
		await addBundleUplinkServer(
			{
				qualifiedName: "acme/foo",
				bundleUrl: "https://cdn.smithery.ai/bundles/foo.mcpb",
				connection: {
					type: "stdio",
					configSchema: {},
					bundleUrl: "https://cdn.smithery.ai/bundles/foo.mcpb",
				},
				server: { qualifiedName: "acme/foo" },
			} as never,
			{ id: "bundle-conn" },
		)

		expect(mockServeUplink).toHaveBeenCalledWith({
			namespace: "calclavia",
			connectionId: "bundle-conn",
			target: {
				kind: "uplink-stdio",
				command: "node",
				args: ["server.js"],
				env: { FOO: "bar" },
			},
			force: undefined,
			onInterrupt: expect.any(Function),
		})
		expect(mockDeleteConnection).not.toHaveBeenCalled()
	})

	test("deletes the uplink connection when the bundle session is interrupted", async () => {
		mockServeUplink.mockImplementationOnce(async (options) => {
			options.onInterrupt?.()
			return 0
		})

		await addBundleUplinkServer(
			{
				qualifiedName: "acme/foo",
				bundleUrl: "https://cdn.smithery.ai/bundles/foo.mcpb",
				connection: {
					type: "stdio",
					configSchema: {},
					bundleUrl: "https://cdn.smithery.ai/bundles/foo.mcpb",
				},
				server: { qualifiedName: "acme/foo" },
			} as never,
			{ id: "bundle-conn" },
		)

		expect(mockDeleteConnection).toHaveBeenCalledWith("bundle-conn")
	})
})
