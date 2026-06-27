import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { strToU8, zipSync } from "fflate"
import { afterEach, describe, expect, it } from "vitest"
import { getBundleDeployPayload } from "../../mcpb.js"

function createBundleFile(
	dir: string,
	manifest: Record<string, unknown>,
): string {
	const bundlePath = join(dir, "server.mcpb")
	const zip = zipSync({
		"manifest.json": strToU8(JSON.stringify(manifest)),
	})
	writeFileSync(
		bundlePath,
		Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength),
	)
	return bundlePath
}

describe("getBundleDeployPayload", () => {
	let tempDir: string

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true })
		}
	})

	it("defaults tools to an empty array when manifest omits tools", () => {
		tempDir = mkdtempSync(join(tmpdir(), "bundle-deploy-payload-test-"))
		const bundlePath = createBundleFile(tempDir, {
			name: "test-server",
			version: "1.0.0",
			server: {
				type: "node",
				mcp_config: {
					command: "node",
				},
			},
		})

		const payload = getBundleDeployPayload(bundlePath)

		expect(payload.serverCard?.tools).toEqual([])
	})

	it("preserves manifest tools when provided", () => {
		tempDir = mkdtempSync(join(tmpdir(), "bundle-deploy-payload-test-"))
		const tools = [{ name: "ping", description: "Ping the server" }]
		const bundlePath = createBundleFile(tempDir, {
			name: "test-server",
			version: "1.0.0",
			server: {
				type: "node",
				mcp_config: {
					command: "node",
				},
			},
			tools,
		})

		const payload = getBundleDeployPayload(bundlePath)

		expect(payload.serverCard?.tools).toEqual(tools)
	})
})
