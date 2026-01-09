import { execSync } from "node:child_process"
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { DeployPayload } from "@smithery/api/resources/servers/deployments"
import chalk from "chalk"

import { buildServer } from "../build.js"
import { type ScanResult, scanModule } from "./scan.js"

export interface ShttpBundleOptions {
	entryFile?: string
	outDir?: string
	production?: boolean
}

export interface ShttpBundleResult {
	outDir: string
	payload: DeployPayload
	moduleFile: string
	sourcemapFile?: string
}

export async function buildShttpBundle(
	options: ShttpBundleOptions = {},
): Promise<ShttpBundleResult> {
	const outDir = options.outDir || ".smithery/shttp"
	const entryFile = options.entryFile

	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true })
	}

	console.log(chalk.cyan("\nBuilding shttp bundle for Smithery deploy..."))

	const moduleFile = join(outDir, "module.js")

	await buildServer({
		entryFile,
		outFile: moduleFile,
		transport: "shttp",
		production: options.production ?? true,
		minify: true,
		bundleMode: "user-module",
		sourceMaps: true,
	})

	console.log(chalk.cyan("\nScanning server capabilities..."))
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
		console.error(chalk.red("\n✗ Failed to scan server capabilities"))
		console.error(chalk.dim(`  ${e instanceof Error ? e.message : e}`))
		console.error(
			chalk.yellow(
				"\nYour server requires configuration to run. Export a createSandboxServer function:",
			),
		)
		console.error(
			chalk.dim(`
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
			chalk.dim(
				"This allows Smithery to scan your server's tools/resources without real credentials.",
			),
		)
		console.error(
			chalk.dim("Learn more: https://smithery.ai/docs/deploy#sandbox-server\n"),
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
		configSchema: scanResult.configSchema,
		serverCard: scanResult.serverCard,
		source: gitInfo,
	}

	const result: ShttpBundleResult = { outDir, payload, moduleFile }

	const sourcemapFile = `${moduleFile}.map`
	if (existsSync(sourcemapFile)) {
		result.sourcemapFile = sourcemapFile
	}

	writeFileSync(join(outDir, "manifest.json"), JSON.stringify(payload, null, 2))

	console.log(
		chalk.green("\n✓ Smithery shttp bundle created at ") + chalk.bold(outDir),
	)

	return result
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
