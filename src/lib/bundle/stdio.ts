import { execSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { packExtension } from "@anthropic-ai/mcpb"
import type { DeployPayload } from "@smithery/api/resources/servers/deployments"
import chalk from "chalk"

import { buildServer } from "../build.js"
import { loadProjectConfig } from "../config-loader.js"
import { copyBundleAssets } from "./copy-assets.js"
import { createMcpbManifest, MCPB_ENTRY_POINT } from "./mcpb-manifest.js"
import { type ScanResult, scanModule } from "./scan.js"

export interface StdioBundleOptions {
	entryFile?: string
	outDir?: string
	production?: boolean
}

export interface StdioBundleResult {
	outDir: string
	payload: DeployPayload
	moduleFile: string
	mcpbFile: string
}

export async function buildStdioBundle(
	options: StdioBundleOptions = {},
): Promise<StdioBundleResult> {
	const outDir = options.outDir || ".smithery/stdio"
	const entryFile = options.entryFile

	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true })
	}

	console.log(chalk.cyan("\nBuilding stdio bundle for Smithery deploy..."))

	const moduleFile = join(outDir, MCPB_ENTRY_POINT)

	await buildServer({
		entryFile,
		outFile: moduleFile,
		transport: "stdio",
		production: options.production ?? true,
		minify: true,
		bundleMode: "bootstrap",
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
		type: "stdio" as const,
		runtime: "node" as const,
		configSchema: scanResult.configSchema,
		serverCard: scanResult.serverCard,
		source: gitInfo,
	}

	// Copy assets if configured
	const projectConfig = loadProjectConfig()
	if (projectConfig?.build?.assets?.length) {
		console.log(chalk.cyan("\nCopying assets..."))
		const { copiedFiles, warnings } = await copyBundleAssets({
			patterns: projectConfig.build.assets,
			baseDir: process.cwd(),
			outDir,
		})
		if (copiedFiles.length > 0) {
			console.log(chalk.dim(`  Copied ${copiedFiles.length} asset(s)`))
		}
		for (const warning of warnings) {
			console.log(chalk.yellow(`  Warning: ${warning}`))
		}
	} else {
		// todo: add link to docs about assets
		console.log(
			chalk.dim(
				'\nℹ Tip: Add "assets" to smithery.yaml to bundle non-code files (e.g., templates, data)',
			),
		)
	}

	console.log(chalk.cyan("\nPacking MCPB bundle..."))

	const mcpbManifest = createMcpbManifest(scanResult)

	writeFileSync(
		join(outDir, "mcpb-manifest.json"),
		JSON.stringify(mcpbManifest, null, 2),
	)

	const tempManifestPath = join(outDir, "manifest.json")
	const mcpbManifestPath = join(outDir, "mcpb-manifest.json")

	const mcpbManifestContent = readFileSync(mcpbManifestPath, "utf-8")
	writeFileSync(tempManifestPath, mcpbManifestContent)

	const mcpbFile = join(outDir, "server.mcpb")
	const packSuccess = await packExtension({
		extensionPath: outDir,
		outputPath: mcpbFile,
		silent: true,
	})

	if (existsSync(tempManifestPath)) {
		unlinkSync(tempManifestPath)
	}

	if (!packSuccess) {
		throw new Error("Failed to pack MCPB bundle")
	}

	writeFileSync(join(outDir, "manifest.json"), JSON.stringify(payload, null, 2))

	console.log(
		chalk.green("\n✓ Smithery stdio bundle created at ") + chalk.bold(outDir),
	)

	return { outDir, payload, moduleFile, mcpbFile }
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
