import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import type { DeployPayload } from "@smithery/api/resources/servers/deployments"
import { loadProjectConfig } from "../config-loader.js"
import { buildShttpBundle } from "./shttp.js"
import { buildStdioBundle } from "./stdio.js"

export interface BundleOptions {
	entryFile?: string
	outDir?: string
	transport?: "shttp" | "stdio"
	production?: boolean
}

/**
 * Self-describing manifest written to disk after a build.
 * This is the single contract between build and publish.
 */
export interface BuildManifest {
	name?: string
	payload: DeployPayload
	artifacts: {
		module?: string
		sourcemap?: string
		bundle?: string
	}
}

export interface ResolvedBuildArtifacts {
	name?: string
	payload: DeployPayload
	modulePath?: string
	sourcemapPath?: string
	bundlePath?: string
}

/**
 * Build a complete Smithery bundle for deployment.
 * Returns the output directory containing manifest.json and artifacts.
 */
export async function buildBundle(
	options: BundleOptions = {},
): Promise<string> {
	const transport = options.transport || "shttp"

	const outDir =
		transport === "stdio"
			? await buildStdioBundle({
					entryFile: options.entryFile,
					outDir: options.outDir,
					production: options.production,
				})
			: await buildShttpBundle({
					entryFile: options.entryFile,
					outDir: options.outDir,
					production: options.production,
				})

	// Inject server name from smithery.yaml into manifest
	const projectConfig = loadProjectConfig()
	if (projectConfig?.name) {
		const manifestPath = join(outDir, "manifest.json")
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
		manifest.name = projectConfig.name
		writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
	}

	return outDir
}

/**
 * Load and validate a build manifest from an output directory.
 * Resolves artifact paths relative to the directory.
 */
export function loadBuildManifest(buildDir: string): ResolvedBuildArtifacts {
	const dir = resolve(buildDir)
	const manifestPath = join(dir, "manifest.json")

	if (!existsSync(manifestPath)) {
		throw new Error(
			`No manifest.json found in ${dir}. Run 'smithery build' first.`,
		)
	}

	let manifest: BuildManifest
	try {
		manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
	} catch {
		throw new Error(`Failed to parse manifest.json in ${dir}`)
	}

	if (!manifest.payload || !manifest.artifacts) {
		throw new Error(
			`Invalid manifest.json in ${dir}. Was it created by an older CLI version?`,
		)
	}

	const result: ResolvedBuildArtifacts = {
		payload: manifest.payload,
		...(manifest.name && { name: manifest.name }),
	}

	if (manifest.artifacts.module) {
		result.modulePath = join(dir, manifest.artifacts.module)
		if (!existsSync(result.modulePath)) {
			throw new Error(`Module file not found: ${result.modulePath}`)
		}
	}

	if (manifest.artifacts.sourcemap) {
		const p = join(dir, manifest.artifacts.sourcemap)
		if (existsSync(p)) {
			result.sourcemapPath = p
		}
	}

	if (manifest.artifacts.bundle) {
		result.bundlePath = join(dir, manifest.artifacts.bundle)
		if (!existsSync(result.bundlePath)) {
			throw new Error(`Bundle file not found: ${result.bundlePath}`)
		}
	}

	return result
}
