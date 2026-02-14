/**
 * Build Manifest Tests
 * Tests loadBuildManifest — the contract between build and publish.
 */

import { beforeEach, describe, expect, test, vi } from "vitest"

vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
}))

import { existsSync, readFileSync } from "node:fs"
import { loadBuildManifest } from "../bundle/index"

describe("loadBuildManifest", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("shttp manifest: resolves module and sourcemap paths", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({
				payload: { type: "hosted", stateful: false, hasAuthAdapter: false },
				artifacts: { module: "module.js", sourcemap: "module.js.map" },
			}),
		)

		const result = loadBuildManifest("/tmp/build")

		expect(result.payload.type).toBe("hosted")
		expect(result.modulePath).toContain("module.js")
		expect(result.sourcemapPath).toContain("module.js.map")
		expect(result.bundlePath).toBeUndefined()
	})

	test("stdio manifest: resolves bundle path", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({
				payload: {
					type: "stdio",
					runtime: "node",
					hasAuthAdapter: false,
					serverCard: { serverInfo: { name: "test", version: "1.0.0" } },
				},
				artifacts: { bundle: "server.mcpb" },
			}),
		)

		const result = loadBuildManifest("/tmp/build")

		expect(result.payload.type).toBe("stdio")
		expect(result.bundlePath).toContain("server.mcpb")
		expect(result.modulePath).toBeUndefined()
	})

	test("no manifest.json: throws with helpful message", () => {
		vi.mocked(existsSync).mockReturnValue(false)

		expect(() => loadBuildManifest("/tmp/build")).toThrow(
			"No manifest.json found",
		)
	})

	test("invalid JSON: throws parse error", () => {
		vi.mocked(existsSync).mockImplementation((p) =>
			String(p).endsWith("manifest.json"),
		)
		vi.mocked(readFileSync).mockReturnValue("not json")

		expect(() => loadBuildManifest("/tmp/build")).toThrow(
			"Failed to parse manifest.json",
		)
	})

	test("missing payload field: throws validation error", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({ artifacts: { module: "module.js" } }),
		)

		expect(() => loadBuildManifest("/tmp/build")).toThrow(
			"Invalid manifest.json",
		)
	})

	test("artifact file missing on disk: throws", () => {
		vi.mocked(existsSync).mockImplementation((p) => {
			// manifest.json exists, but module.js does not
			return String(p).endsWith("manifest.json")
		})
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({
				payload: { type: "hosted", stateful: false, hasAuthAdapter: false },
				artifacts: { module: "module.js" },
			}),
		)

		expect(() => loadBuildManifest("/tmp/build")).toThrow(
			"Module file not found",
		)
	})
})
