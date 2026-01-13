/**
 * Deploy Command Tests
 * Validates deployment flow, namespace resolution, and API interactions
 */

import { Readable } from "node:stream"
import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock dependencies
vi.mock("@smithery/api", () => ({
	Smithery: vi.fn(),
}))

vi.mock("../../utils/runtime", () => ({
	ensureApiKey: vi.fn().mockResolvedValue("test-api-key"),
}))

vi.mock("../../lib/bundle/index", () => ({
	buildBundle: vi.fn(),
}))

vi.mock("../../utils/command-prompts", () => ({
	promptForNamespaceCreation: vi.fn(),
	promptForNamespaceSelection: vi.fn(),
	promptForServerNameInput: vi.fn(),
}))

vi.mock("../../lib/config-loader", () => ({
	loadProjectConfig: vi.fn(),
}))

vi.mock("../../lib/namespace", async () => {
	const actual = await vi.importActual<typeof import("../../lib/namespace")>(
		"../../lib/namespace",
	)
	return {
		...actual,
	}
})

vi.mock("ora", () => ({
	default: vi.fn(() => ({
		start: vi.fn().mockReturnThis(),
		succeed: vi.fn().mockReturnThis(),
		fail: vi.fn().mockReturnThis(),
		stop: vi.fn().mockReturnThis(),
	})),
}))

vi.mock("node:fs", () => ({
	createReadStream: vi.fn((_path: string) => {
		const stream = new Readable()
		stream.push("mock file content")
		stream.push(null)
		return stream
	}),
	existsSync: vi.fn().mockReturnValue(true),
}))

import { Smithery } from "@smithery/api"
import { buildBundle } from "../../lib/bundle/index"
import { loadProjectConfig } from "../../lib/config-loader"
import { resolveNamespace } from "../../lib/namespace"
import {
	promptForNamespaceCreation,
	promptForNamespaceSelection,
	promptForServerNameInput,
} from "../../utils/command-prompts"
import { ensureApiKey } from "../../utils/runtime"
import { deploy } from "../deploy"

describe("deploy command", () => {
	let mockRegistry: {
		namespaces: {
			list: ReturnType<typeof vi.fn>
			create: ReturnType<typeof vi.fn>
		}
		servers: {
			deployments: {
				deploy: ReturnType<typeof vi.fn>
				retrieve: ReturnType<typeof vi.fn>
			}
		}
	}

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup default loadProjectConfig mock return value (no config file)
		vi.mocked(loadProjectConfig).mockReturnValue(null)

		// Setup default buildBundle mock return value
		vi.mocked(buildBundle).mockResolvedValue({
			outDir: "/tmp/build",
			payload: { type: "hosted", stateful: false },
			moduleFile: "/tmp/build/module.js",
			sourcemapFile: "/tmp/build/module.js.map",
		})

		// Setup mock registry
		mockRegistry = {
			namespaces: {
				list: vi.fn(),
				create: vi.fn().mockResolvedValue(undefined),
			},
			servers: {
				deployments: {
					deploy: vi.fn().mockResolvedValue({
						deploymentId: "test-deployment-id",
					}),
					retrieve: vi.fn().mockResolvedValue({
						status: "SUCCESS",
						logs: [],
						mcpUrl: "mcp://test.example.com",
					}),
				},
			},
		}

		vi.mocked(Smithery).mockImplementation(
			() => mockRegistry as unknown as Smithery,
		)
	})

	test("--name provided: uses qualified name directly for deploy API", async () => {
		await deploy({ name: "myorg/myserver" })

		expect(ensureApiKey).toHaveBeenCalledWith(undefined)
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: expect.any(String),
			}),
		)
		expect(promptForNamespaceCreation).not.toHaveBeenCalled()
		expect(promptForNamespaceSelection).not.toHaveBeenCalled()
		expect(promptForServerNameInput).not.toHaveBeenCalled()
	})

	test("no --name, single namespace: auto-selects namespace and prompts for server name", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "myorg" }],
		})
		vi.mocked(promptForServerNameInput).mockResolvedValue("myserver")

		await deploy({})

		expect(mockRegistry.namespaces.list).toHaveBeenCalled()
		expect(promptForNamespaceSelection).not.toHaveBeenCalled()
		expect(promptForNamespaceCreation).not.toHaveBeenCalled()
		expect(promptForServerNameInput).toHaveBeenCalledWith("myorg")
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.any(Object),
		)
	})

	test("no --name, multiple namespaces: prompts to select namespace and server name", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "org1" }, { name: "org2" }],
		})
		vi.mocked(promptForNamespaceSelection).mockResolvedValue("org2")
		vi.mocked(promptForServerNameInput).mockResolvedValue("myserver")

		await deploy({})

		expect(mockRegistry.namespaces.list).toHaveBeenCalled()
		expect(promptForNamespaceSelection).toHaveBeenCalledWith(["org1", "org2"])
		expect(promptForServerNameInput).toHaveBeenCalledWith("org2")
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"org2/myserver",
			expect.any(Object),
		)
		expect(mockRegistry.namespaces.create).not.toHaveBeenCalled()
	})

	test("no --name, no namespaces: prompts to create namespace (with claim messaging) and server name", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [],
		})
		vi.mocked(promptForNamespaceCreation).mockResolvedValue("neworg")
		vi.mocked(promptForServerNameInput).mockResolvedValue("myserver")

		await deploy({})

		expect(mockRegistry.namespaces.list).toHaveBeenCalled()
		expect(promptForNamespaceCreation).toHaveBeenCalled()
		expect(mockRegistry.namespaces.create).toHaveBeenCalledWith({
			name: "neworg",
		})
		expect(promptForServerNameInput).toHaveBeenCalledWith("neworg")
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"neworg/myserver",
			expect.any(Object),
		)
	})

	test("--url provided: performs external deploy without bundle build", async () => {
		await deploy({ name: "myorg/myserver", url: "https://example.com/mcp" })

		expect(buildBundle).not.toHaveBeenCalled()
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: JSON.stringify({
					type: "external",
					upstreamUrl: "https://example.com/mcp",
				}),
			}),
		)
	})

	test("--transport stdio: respects transport type and builds stdio bundle", async () => {
		vi.mocked(buildBundle).mockResolvedValue({
			outDir: "/tmp/build",
			payload: { type: "stdio", runtime: "node" },
			moduleFile: "/tmp/build/module.js",
			mcpbFile: "/tmp/build/bundle.mcpb",
		})

		await deploy({ name: "myorg/myserver", transport: "stdio" })

		expect(buildBundle).toHaveBeenCalledWith({
			entryFile: undefined,
			transport: "stdio",
			production: true,
		})
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: expect.stringContaining('"type":"stdio"'),
				bundle: expect.any(Readable),
			}),
		)
	})

	test("--transport shttp: respects transport type and builds shttp bundle", async () => {
		vi.mocked(buildBundle).mockResolvedValue({
			outDir: "/tmp/build",
			payload: { type: "hosted", stateful: false },
			moduleFile: "/tmp/build/module.js",
			sourcemapFile: "/tmp/build/module.js.map",
		})

		await deploy({ name: "myorg/myserver", transport: "shttp" })

		expect(buildBundle).toHaveBeenCalledWith({
			entryFile: undefined,
			transport: "shttp",
			production: true,
		})
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: expect.stringContaining('"type":"hosted"'),
				module: expect.any(Readable),
			}),
		)
	})

	test("no --name, smithery.yaml with typescript runtime and name: uses name without prompting", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "myorg" }],
		})
		vi.mocked(loadProjectConfig).mockReturnValue({
			runtime: "typescript",
			name: "my-server-name",
		})

		await deploy({})

		expect(loadProjectConfig).toHaveBeenCalled()
		expect(promptForServerNameInput).not.toHaveBeenCalled()
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"myorg/my-server-name",
			expect.any(Object),
		)
	})

	test("no --name, smithery.yaml exists but no name field: prompts for server name", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "myorg" }],
		})
		vi.mocked(loadProjectConfig).mockReturnValue({
			runtime: "typescript",
		})
		vi.mocked(promptForServerNameInput).mockResolvedValue("myserver")

		await deploy({})

		expect(loadProjectConfig).toHaveBeenCalled()
		expect(promptForServerNameInput).toHaveBeenCalledWith("myorg")
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.any(Object),
		)
	})

	test("no --name, smithery.yaml with non-typescript runtime: prompts for server name", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "myorg" }],
		})
		vi.mocked(loadProjectConfig).mockReturnValue({
			runtime: "python",
		})
		vi.mocked(promptForServerNameInput).mockResolvedValue("myserver")

		await deploy({})

		expect(loadProjectConfig).toHaveBeenCalled()
		expect(promptForServerNameInput).toHaveBeenCalledWith("myorg")
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.any(Object),
		)
	})

	test("no --name, smithery.yaml doesn't exist: prompts for server name", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "myorg" }],
		})
		vi.mocked(loadProjectConfig).mockReturnValue(null)
		vi.mocked(promptForServerNameInput).mockResolvedValue("myserver")

		await deploy({})

		expect(loadProjectConfig).toHaveBeenCalled()
		expect(promptForServerNameInput).toHaveBeenCalledWith("myorg")
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.any(Object),
		)
	})

	test("no --name, smithery.yaml with name and no namespaces: uses name after creating namespace", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [],
		})
		vi.mocked(promptForNamespaceCreation).mockResolvedValue("neworg")
		vi.mocked(loadProjectConfig).mockReturnValue({
			runtime: "typescript",
			name: "my-server-name",
		})

		await deploy({})

		expect(loadProjectConfig).toHaveBeenCalled()
		expect(promptForNamespaceCreation).toHaveBeenCalled()
		expect(mockRegistry.namespaces.create).toHaveBeenCalledWith({
			name: "neworg",
		})
		expect(promptForServerNameInput).not.toHaveBeenCalled()
		expect(mockRegistry.servers.deployments.deploy).toHaveBeenCalledWith(
			"neworg/my-server-name",
			expect.any(Object),
		)
	})

	test("403 error: handles namespace ownership error correctly", async () => {
		const error = {
			status: 403,
			body$: "You don't own the namespace",
			message: "Forbidden",
		}
		mockRegistry.servers.deployments.deploy.mockRejectedValue(error)

		await expect(deploy({ name: "otherorg/myserver" })).rejects.toThrow(
			"process.exit() was called",
		)
	})

	test("403 error: handles server ownership error correctly", async () => {
		const error = {
			status: 403,
			body$: "You don't own the server",
			message: "Forbidden",
		}
		mockRegistry.servers.deployments.deploy.mockRejectedValue(error)

		await expect(deploy({ name: "myorg/myserver" })).rejects.toThrow(
			"process.exit() was called",
		)
	})

	test("404 error: handles namespace not found error correctly", async () => {
		const error = {
			status: 404,
			body$: "Namespace not found",
			message: "Not found",
		}
		mockRegistry.servers.deployments.deploy.mockRejectedValue(error)

		await expect(deploy({ name: "nonexistent/myserver" })).rejects.toThrow(
			"process.exit() was called",
		)
	})

	test("404 error: handles server not found error correctly", async () => {
		const error = {
			status: 404,
			body$: "Server not found",
			message: "Not found",
		}
		mockRegistry.servers.deployments.deploy.mockRejectedValue(error)

		await expect(deploy({ name: "myorg/nonexistent" })).rejects.toThrow(
			"process.exit() was called",
		)
	})
})

describe("resolveNamespace", () => {
	let mockRegistry: {
		namespaces: {
			list: ReturnType<typeof vi.fn>
			create: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		vi.clearAllMocks()

		mockRegistry = {
			namespaces: {
				list: vi.fn(),
				create: vi.fn().mockResolvedValue(undefined),
			},
		}

		vi.mocked(Smithery).mockImplementation(
			() => mockRegistry as unknown as Smithery,
		)
	})

	test("single namespace: auto-selects it", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "myorg" }],
		})

		const result = await resolveNamespace(mockRegistry as unknown as Smithery)

		expect(result).toBe("myorg")
		expect(promptForNamespaceSelection).not.toHaveBeenCalled()
		expect(promptForNamespaceCreation).not.toHaveBeenCalled()
	})

	test("multiple namespaces: prompts to select", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "org1" }, { name: "org2" }],
		})
		vi.mocked(promptForNamespaceSelection).mockResolvedValue("org2")

		const result = await resolveNamespace(mockRegistry as unknown as Smithery)

		expect(result).toBe("org2")
		expect(promptForNamespaceSelection).toHaveBeenCalledWith(["org1", "org2"])
		expect(promptForNamespaceCreation).not.toHaveBeenCalled()
	})

	test("no namespaces: prompts to create and claim namespace", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [],
		})
		vi.mocked(promptForNamespaceCreation).mockResolvedValue("neworg")

		const result = await resolveNamespace(mockRegistry as unknown as Smithery)

		expect(result).toBe("neworg")
		expect(promptForNamespaceCreation).toHaveBeenCalled()
		expect(mockRegistry.namespaces.create).toHaveBeenCalledWith({
			name: "neworg",
		})
		expect(promptForNamespaceSelection).not.toHaveBeenCalled()
	})
})
