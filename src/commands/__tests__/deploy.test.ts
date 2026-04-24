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

vi.mock("yocto-spinner", () => ({
	default: vi.fn(() => ({
		start: vi.fn().mockReturnThis(),
		success: vi.fn().mockReturnThis(),
		error: vi.fn().mockReturnThis(),
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
	writeFileSync: vi.fn(),
}))

vi.mock("node:child_process", () => ({
	spawn: vi.fn(() => ({
		unref: vi.fn(),
	})),
}))

vi.mock("../../utils/output", () => ({
	isJsonMode: vi.fn().mockReturnValue(false),
}))

import { NotFoundError, PermissionDeniedError, Smithery } from "@smithery/api"
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

	test("--name provided with bundle target: uses qualified name directly for deploy API", async () => {
		await deploy({
			name: "myorg/myserver",
			entryFile: "/tmp/server.mcpb",
		})

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

	test("no --name with bundle target: auto-selects namespace and prompts for server name", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "myorg" }],
		})
		vi.mocked(promptForServerNameInput).mockResolvedValue("myserver")

		await deploy({ entryFile: "/tmp/server.mcpb" })

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

	test("no --name with multiple namespaces: prompts to select namespace and server name", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "org1" }, { name: "org2" }],
		})
		vi.mocked(promptForNamespaceSelection).mockResolvedValue("org2")
		vi.mocked(promptForServerNameInput).mockResolvedValue("myserver")

		await deploy({ entryFile: "/tmp/server.mcpb" })

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

	test("no --name with no namespaces: prompts to create namespace and server name", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [],
		})
		vi.mocked(promptForNamespaceCreation).mockResolvedValue("neworg")
		vi.mocked(promptForServerNameInput).mockResolvedValue("myserver")

		await deploy({ entryFile: "/tmp/server.mcpb" })

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
				entryFile: "/tmp/server.mcpb",
				configSchema: '{"type":"object"}',
			}),
		).rejects.toThrow("process.exit() was called")
	})

	test("missing target without --resume: exits with error", async () => {
		await expect(deploy({ name: "myorg/myserver" })).rejects.toThrow(
			"process.exit() was called",
		)
	})

	test("non-bundle local target: exits with error", async () => {
		await expect(
			deploy({
				name: "myorg/myserver",
				entryFile: "./server.ts",
			}),
		).rejects.toThrow("process.exit() was called")
	})

	test("no --name, smithery.yaml with name: uses name without prompting", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "myorg" }],
		})
		vi.mocked(loadProjectConfig).mockReturnValue({
			name: "my-server-name",
		})

		await deploy({ entryFile: "/tmp/server.mcpb" })

		expect(loadProjectConfig).toHaveBeenCalled()
		expect(promptForServerNameInput).not.toHaveBeenCalled()
		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/my-server-name",
			expect.objectContaining({
				payload: expect.any(String),
			}),
		)
	})

	test("no --name, smithery.yaml exists without name: prompts for server name", async () => {
		mockRegistry.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "myorg" }],
		})
		vi.mocked(loadProjectConfig).mockReturnValue({})
		vi.mocked(promptForServerNameInput).mockResolvedValue("myserver")

		await deploy({ entryFile: "/tmp/server.mcpb" })

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

		await deploy({ entryFile: "/tmp/server.mcpb" })

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
			name: "my-server-name",
		})

		await deploy({ entryFile: "/tmp/server.mcpb" })

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

		await expect(
			deploy({ name: "otherorg/myserver", entryFile: "/tmp/server.mcpb" }),
		).rejects.toThrow("process.exit() was called")
	})

	test("403 error: handles server ownership error correctly", async () => {
		const error = new PermissionDeniedError(
			403,
			{ error: "You don't own the server" },
			"Forbidden",
			new Headers(),
		)
		mockRegistry.servers.releases.deploy.mockRejectedValue(error)

		await expect(
			deploy({ name: "myorg/myserver", entryFile: "/tmp/server.mcpb" }),
		).rejects.toThrow("process.exit() was called")
	})

	test("404 error: handles namespace not found error correctly", async () => {
		const error = new NotFoundError(
			404,
			{ error: "Namespace not found" },
			"Not found",
			new Headers(),
		)
		mockRegistry.servers.releases.deploy.mockRejectedValue(error)

		await expect(
			deploy({ name: "nonexistent/myserver", entryFile: "/tmp/server.mcpb" }),
		).rejects.toThrow()
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Namespace"),
		)
	})

	test(".mcpb path: uploads bundle artifact without building", async () => {
		await deploy({
			name: "myorg/myserver",
			entryFile: "/my/prebuilt/server.mcpb",
		})

		expect(mockRegistry.servers.releases.deploy).toHaveBeenCalledWith(
			"myorg/myserver",
			expect.objectContaining({
				payload: expect.stringContaining('"type":"stdio"'),
				bundle: expect.anything(),
			}),
		)
	})

	test("non-TTY mode: spawns background watcher and outputs JSON", async () => {
		const { isJsonMode } = await import("../../utils/output")
		const { spawn } = await import("node:child_process")
		const { writeFileSync } = await import("node:fs")

		vi.mocked(isJsonMode).mockReturnValue(true)

		const consoleSpy = vi.spyOn(console, "log")

		await deploy({ name: "myorg/myserver", entryFile: "/tmp/server.mcpb" })

		// Should write empty log file
		expect(writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining("smithery-deploy-test-deployment-id.log"),
			"",
		)

		// Should spawn background watcher
		expect(spawn).toHaveBeenCalledWith(
			process.execPath,
			expect.arrayContaining([
				"_watch-deploy",
				"test-deployment-id",
				"myorg/myserver",
			]),
			expect.objectContaining({
				detached: true,
				stdio: "ignore",
			}),
		)

		// Should output JSON with deployment info
		const jsonOutput = consoleSpy.mock.calls.find((call) => {
			try {
				const parsed = JSON.parse(call[0])
				return parsed.deploymentId === "test-deployment-id"
			} catch {
				return false
			}
		})
		expect(jsonOutput).toBeDefined()
		const parsed = JSON.parse(jsonOutput![0])
		expect(parsed).toMatchObject({
			deploymentId: "test-deployment-id",
			qualifiedName: "myorg/myserver",
			status: "PENDING",
			logFile: expect.stringContaining(
				"smithery-deploy-test-deployment-id.log",
			),
			statusUrl: "https://smithery.ai/servers/myorg/myserver/releases",
		})

		// Should NOT have polled deployment status
		expect(mockRegistry.servers.releases.get).not.toHaveBeenCalled()

		// Restore
		vi.mocked(isJsonMode).mockReturnValue(false)
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

		await deploy({ name: "myorg/nonexistent", entryFile: "/tmp/server.mcpb" })

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
