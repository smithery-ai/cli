import { mkdtempSync, writeFileSync } from "node:fs"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { strToU8, zipSync } from "fflate"
import { afterEach, describe, expect, it } from "vitest"
import { getBundleDeployPayload } from "../../mcpb.js"

describe("getBundleDeployPayload", () => {
	const tempDirs: string[] = []

	afterEach(async () => {
		await Promise.all(
			tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })),
		)
	})

	it("maps MCPB uv servers to the Python deployment runtime", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "mcpb-deploy-payload-test-"))
		tempDirs.push(tempDir)
		const bundlePath = join(tempDir, "server.mcpb")
		const manifest = {
			manifest_version: "0.4",
			name: "uv-server",
			version: "1.0.0",
			server: {
				type: "uv",
				entry_point: "src/server.py",
			},
		}
		const bundle = zipSync({
			"manifest.json": strToU8(JSON.stringify(manifest)),
		})
		writeFileSync(bundlePath, bundle)

		expect(getBundleDeployPayload(bundlePath)).toMatchObject({
			type: "stdio",
			runtime: "python",
			serverCard: {
				serverInfo: {
					name: "uv-server",
					version: "1.0.0",
				},
			},
		})
	})
})
