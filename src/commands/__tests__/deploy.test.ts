/**
 * Deploy Command Tests
 * Validates deployment flow, namespace resolution, and API interactions
 */

import { Readable } from "node:stream"
import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock dependencies
vi.mock("@smithery/api", () => {
	class PermissionDeniedError extends Error {
		readonly status: number
		readonly error: { error?: string }
		readonly headers: Headers
		constructor(
			status: number,
			error: { error?: string },
			message?: string,
			headers?: Headers,
		) {
			super(message || `403 ${JSON.stringify(error)}`)
			this.name = "PermissionDeniedError"
			this.status = status
			this.error = error
			this.headers = headers || new Headers()
		}
	}

	class NotFoundError extends Error {
		readonly status: number
		readonly error: { error?: string }
		readonly headers: Headers
		constructor(
			status: number,
			error: { error?: string },
			message?: string,
			headers?: Headers,
		) {
			super(message || `404 ${JSON.stringify(error)}`)
			this.name = "NotFoundError"
			this.status = status
			this.error = error
			this.headers = headers || new Headers()
		}
	}

	class AuthenticationError extends Error {
		constructor(message?: string) {
			super(message || "Authentication failed")
			this.name = "AuthenticationError"
		}
	}
	class BadRequestError extends Error {
		constructor(message?: string) {
			super(message || "Bad request")
			this.name = "BadRequestError"
		}
	}
	class ConflictError extends Error {
		constructor(message?: string) {
			super(message || "Conflict")
			this.name = "ConflictError"
		}
	}

	return {
		Smithery: vi.fn(),
		PermissionDeniedError,
		NotFoundError,
		AuthenticationError,
		BadRequestError,
		ConflictError,
	}
})

vi.mock("../../utils/runtime", () => ({
	ensureApiKey: vi.fn().mockResolvedValue("test-api-key"),
}))

vi.mock("../../lib/bundle/index", () => ({
	buildBundle: vi.fn(),
	loadBuildManifest: vi.fn(),
}))

vi.mock("../../utils/command-prompts", () => ({
	promptForNamespaceCreation: vi.fn(),
	promptForNamespaceSelection: vi.fn(),
	promptForServerNameInput: vi.fn(),
}))

vi.mock("../../utils/cli-utils", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../utils/cli-utils")>()
	return {
		...actual,
		parseConfigSchema: vi.fn((input: string) => JSON.parse(input)),
	}
})

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

import { NotFoundError, PermissionDeniedError, Smithery } from "@smithery/api"
import { buildBundle, loadBuildManifest } from "../../lib/bundle/index"
import { loadProjectConfig } from "../../lib/config-loader"
import { resolveNamespace } from "../../lib/namespace"
import {
	promptForNamespaceCreation,
	promptForNamespaceSelection,
	promptForServerNameInput,
} from "../../utils/command-prompts"
import { ensureApiKey } from "../../utils/runtime"
import { deploy } from "../mcp/deploy"

describe("deploy command", () => {
	let mockRegistry: {
		namespaces: {
			list: ReturnType<typeof vi.fn>
			set: ReturnType<typeof vi.fn>
		}
		servers: {
			get: ReturnType<typeof vi.fn>
			create: ReturnType<typeof vi.fn>
			releases: {
				deploy: ReturnType<typeof vi.fn>
				get: ReturnType<typeof vi.fn>
			}
		}
	}

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup default loadProjectConfig mock return value (no config file)
		vi.mocked(loadProjectConfig).mockReturnValue(null)

		// Setup default buildBundle mock (returns outDir string)
		vi.mocked(buildBundle).mockResolvedValue("/tmp/build")

		// Setup default loadBuildManifest mock (returns resolved artifacts)
		vi.mocked(loadBuildManifest).mockReturnValue({
			payload: { type: "hosted", stateful: false, hasAuthAdapter: false },
			modulePath: "/tmp/build/module.js",
			sourcemapPath: "/tmp/build/module.js.map",
		})

		// Setup mock registry
		mockRegistry = {
			namespaces: {
				list: vi.fn(),
				set: vi.fn().mockResolvedValue(undefined),
			},
			servers: {
				get: vi.fn().mockResolvedValue({}),
				create: vi.fn().mockResolvedValue({}),
				releases: {
					deploy: vi.fn().mockResolvedValue({
						deploymentId: "test-deployment-id",
					}),
					get: vi.fn().mockResolvedValue({
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

		expect(ensureApiKey).toHaveBeenCalled()
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
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
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: expect.any(String),
			}),
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
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"org2/myserver",
			expect.objectContaining({
				payload: expect.any(String),
			}),
		)
		expect(mockRegistry.namespaces.set).not.toHaveBeenCalled()
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
		expect(mockRegistry.namespaces.set).toHaveBeenCalledWith("neworg")
		expect(promptForServerNameInput).toHaveBeenCalledWith("neworg")
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"neworg/myserver",
			expect.objectContaining({
				payload: expect.any(String),
			}),
		)
	})

	test("--url provided: performs external deploy without bundle build", async () => {
		await deploy({ name: "myorg/myserver", url: "https://example.com/mcp" })

		expect(buildBundle).not.toHaveBeenCalled()
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: JSON.stringify({
					type: "external",
					upstreamUrl: "https://example.com/mcp",
				}),
			}),
		)
	})

	test("--config-schema with --url: includes configSchema in external deploy payload", async () => {
		const configSchema = {
			type: "object",
			properties: {
				apiKey: { type: "string", "x-from": { header: "x-api-key" } },
			},
			required: ["apiKey"],
		}

		await deploy({
			name: "myorg/myserver",
			url: "https://example.com/mcp",
			configSchema: JSON.stringify(configSchema),
		})

		expect(buildBundle).not.toHaveBeenCalled()
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: JSON.stringify({
					type: "external",
					upstreamUrl: "https://example.com/mcp",
					configSchema,
				}),
			}),
		)
	})

	test("--config-schema without --url: rejects with error", async () => {
		await expect(
			deploy({
				name: "myorg/myserver",
				configSchema: '{"type":"object"}',
			}),
		).rejects.toThrow("process.exit() was called")

		expect(buildBundle).not.toHaveBeenCalled()
	})

	test("inline build: always uses shttp transport", async () => {
		vi.mocked(buildBundle).mockResolvedValue("/tmp/build")
		vi.mocked(loadBuildManifest).mockReturnValue({
			payload: { type: "hosted", stateful: false, hasAuthAdapter: false },
			modulePath: "/tmp/build/module.js",
			sourcemapPath: "/tmp/build/module.js.map",
		})

		await deploy({ name: "myorg/myserver" })

		expect(buildBundle).toHaveBeenCalledWith({
			entryFile: undefined,
			transport: "shttp",
			production: true,
		})
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: expect.stringContaining('"type":"hosted"'),
				module: expect.any(Readable),
			}),
		)
	})

	test("assets configured: logs warning since publish uses shttp", async () => {
		const consoleSpy = vi.spyOn(console, "log")
		vi.mocked(loadProjectConfig).mockReturnValue({
			build: {
				assets: ["data/**"],
			},
		})

		await deploy({ name: "myorg/myserver" })

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("build.assets is only supported"),
		)
		consoleSpy.mockRestore()
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
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/my-server-name",
			expect.objectContaining({
				payload: expect.any(String),
			}),
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
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: expect.any(String),
			}),
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
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: expect.any(String),
			}),
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
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: expect.any(String),
			}),
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
		expect(mockRegistry.namespaces.set).toHaveBeenCalledWith("neworg")
		expect(promptForServerNameInput).not.toHaveBeenCalled()
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"neworg/my-server-name",
			expect.objectContaining({
				payload: expect.any(String),
			}),
		)
	})

	test("403 error: handles namespace ownership error correctly", async () => {
		const error = new PermissionDeniedError(
			403,
			{ error: "You don't own the namespace" },
			"Forbidden",
			new Headers(),
		)
		mockRegistry.servers.releases.deploy.mockRejectedValue(error)

		await expect(deploy({ name: "otherorg/myserver" })).rejects.toThrow(
			"process.exit() was called",
		)
	})

	test("403 error: handles server ownership error correctly", async () => {
		const error = new PermissionDeniedError(
			403,
			{ error: "You don't own the server" },
			"Forbidden",
			new Headers(),
		)
		mockRegistry.servers.releases.deploy.mockRejectedValue(error)

		await expect(deploy({ name: "myorg/myserver" })).rejects.toThrow(
			"process.exit() was called",
		)
	})

	test("404 error: handles namespace not found error correctly", async () => {
		const error = new NotFoundError(
			404,
			{ error: "Namespace not found" },
			"Not found",
			new Headers(),
		)
		mockRegistry.servers.releases.deploy.mockRejectedValue(error)

		await expect(deploy({ name: "nonexistent/myserver" })).rejects.toThrow()
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Namespace"),
		)
	})

	test("--from-build: skips build and loads manifest from directory", async () => {
		vi.mocked(loadBuildManifest).mockReturnValue({
			payload: { type: "hosted", stateful: false, hasAuthAdapter: false },
			modulePath: "/my/prebuilt/module.js",
			sourcemapPath: "/my/prebuilt/module.js.map",
		})

		await deploy({ name: "myorg/myserver", fromBuild: "/my/prebuilt" })

		expect(buildBundle).not.toHaveBeenCalled()
		expect(loadBuildManifest).toHaveBeenCalledWith("/my/prebuilt")
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: expect.stringContaining('"type":"hosted"'),
				module: expect.anything(),
			}),
		)
	})

	test("--from-build with stdio: uploads bundle artifact", async () => {
		vi.mocked(loadBuildManifest).mockReturnValue({
			payload: { type: "stdio", runtime: "node", hasAuthAdapter: false },
			bundlePath: "/my/prebuilt/server.mcpb",
		})

		await deploy({ name: "myorg/myserver", fromBuild: "/my/prebuilt" })

		expect(buildBundle).not.toHaveBeenCalled()
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: expect.stringContaining('"type":"stdio"'),
				bundle: expect.anything(),
			}),
		)
	})

	test("--from-build without --name: uses name from manifest", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "myorg" }],
		})
		vi.mocked(loadBuildManifest).mockReturnValue({
			name: "my-server",
			payload: { type: "hosted", stateful: false, hasAuthAdapter: false },
			modulePath: "/my/prebuilt/module.js",
		})

		await deploy({ fromBuild: "/my/prebuilt" })

		expect(buildBundle).not.toHaveBeenCalled()
		expect(loadBuildManifest).toHaveBeenCalledWith("/my/prebuilt")
		expect(promptForServerNameInput).not.toHaveBeenCalled()
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/my-server",
			expect.objectContaining({
				payload: expect.any(String),
			}),
		)
	})

	test("--from-build with --url: exits with error", async () => {
		await expect(
			deploy({
				name: "myorg/myserver",
				fromBuild: "/my/prebuilt",
				url: "https://example.com/mcp",
			}),
		).rejects.toThrow("process.exit() was called")

		expect(buildBundle).not.toHaveBeenCalled()
	})

	test("404 error: auto-creates server and retries deploy", async () => {
		const error = new NotFoundError(
			404,
			{ error: "Server not found" },
			"Not found",
			new Headers(),
		)
		// First deploy fails with 404, retry succeeds
		mockRegistry.servers.releases.deploy
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce({ deploymentId: "retry-id" })

		await deploy({ name: "myorg/nonexistent" })

		expect(mockRegistry.servers.create).toHaveBeenCalledWith(
			"myorg/nonexistent",
		)
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledTimes(2)
	})
})

describe("resolveNamespace", () => {
	let mockRegistry: {
		namespaces: {
			list: ReturnType<typeof vi.fn>
			set: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		vi.clearAllMocks()

		mockRegistry = {
			namespaces: {
				list: vi.fn(),
				set: vi.fn().mockResolvedValue(undefined),
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
		expect(mockRegistry.namespaces.set).toHaveBeenCalledWith("neworg")
		expect(promptForNamespaceSelection).not.toHaveBeenCalled()
	})
})
