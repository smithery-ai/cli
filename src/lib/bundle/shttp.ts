import { execSync } from "node:child_process"
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { DeployPayload } from "@smithery/api/resources/servers/releases"
import pc from "picocolors"

import { buildServer } from "../build.js"
import type { BuildManifest } from "./index.js"
import { type ScanResult, scanModule } from "./scan.js"

export interface ShttpBundleOptions {
	entryFile?: string
	outDir?: string
	production?: boolean
}

export async function buildShttpBundle(
	options: ShttpBundleOptions = {},
): Promise<string> {
	const outDir = options.outDir || ".smithery/shttp"
	const entryFile = options.entryFile

	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true })
	}

	console.log(pc.cyan("\nBuilding shttp bundle for Smithery deploy..."))

	const moduleFile = join(outDir, "module.js")

	await buildServer({
		entryFile,
		outFile: moduleFile,
		transport: "shttp",
		production: options.production ?? true,
		minify: false,
		bundleMode: "user-module",
		sourceMaps: true,
	})

	console.log(pc.cyan("\nScanning server capabilities..."))
	const scanModuleFile = join(outDir, `scan-${Date.now()}.cjs`)
	await buildServer({
		entryFile,
		outFile: scanModuleFile,
		transport: "stdio",
		bundleMode: "user-module",
		production: false,
		minify: false,
		sourceMaps: false,
	})

	let scanResult: ScanResult = {}
	try {
		scanResult = await scanModule(scanModuleFile)
	} catch (e) {
		console.error(pc.red("\n✗ Failed to scan server capabilities"))
		console.error(pc.dim(`  ${e instanceof Error ? e.message : e}`))
		console.error(
			pc.yellow(
				"\nYour server requires configuration to run. Export a createSandboxServer function:",
			),
		)
		console.error(
			pc.dim(`
  // In your server entry file:
  import { createServer } from "./server"

  export function createSandboxServer() {
    // Return a server instance with mock/default config for scanning
    return createServer({
      apiKey: "test-key",
      // ... other required config with safe defaults
    })
  }
`),
		)
		console.error(
			pc.dim(
				"This allows Smithery to scan your server's tools/resources without real credentials.",
			),
		)
		console.error(
			pc.dim("Learn more: https://smithery.ai/docs/deploy#sandbox-server\n"),
		)
		throw new Error("Server scan failed - cannot generate server card")
	} finally {
		if (existsSync(scanModuleFile)) {
			unlinkSync(scanModuleFile)
		}
	}

	const gitInfo = getGitInfo()

	const payload: DeployPayload = {
		type: "hosted",
		stateful: scanResult.stateful ?? false,
		hasAuthAdapter: scanResult.hasAuthAdapter ?? false,
		configSchema: scanResult.configSchema,
		serverCard: scanResult.serverCard,
		source: gitInfo,
	}

	const sourcemapFile = `${moduleFile}.map`
	const hasSourcemap = existsSync(sourcemapFile)

	const manifest: BuildManifest = {
		payload,
		artifacts: {
			module: "module.js",
			...(hasSourcemap && { sourcemap: "module.js.map" }),
		},
	}
	writeFileSync(
		join(outDir, "manifest.json"),
		JSON.stringify(manifest, null, 2),
	)

	console.log(
		pc.green("\n✓ Smithery shttp bundle created at ") + pc.bold(outDir),
	)

	return outDir
}

function getGitInfo(): { commit?: string; branch?: string } {
	try {
		const commit = execSync("git rev-parse HEAD", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim()
		const branch = execSync("git rev-parse --abbrev-ref HEAD", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim()
		return { commit, branch }
	} catch {
		return {}
	}
}
