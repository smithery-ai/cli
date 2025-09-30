import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import fetch from "cross-fetch"
import { verbose } from "./logger"

const BUNDLE_FILENAME = "server.mcpb"

/**
 * Gets the cache directory for a specific server
 */
export function getServerCacheDir(qualifiedName: string): string {
	return path.join(os.homedir(), ".smithery", "cache", "servers", qualifiedName)
}

/**
 * Gets the path to the bundle directory
 */
export function getBundleDir(qualifiedName: string): string {
	return path.join(getServerCacheDir(qualifiedName), "current")
}

/**
 * Checks if a bundle is cached locally
 */
export function isBundleCached(qualifiedName: string): boolean {
	const bundleDir = getBundleDir(qualifiedName)
	const manifestPath = path.join(bundleDir, "manifest.json")
	return fs.existsSync(manifestPath)
}

/**
 * Downloads a bundle file from a URL
 */
async function downloadBundle(
	bundleUrl: string,
	destinationPath: string,
): Promise<void> {
	verbose(`Downloading bundle from: ${bundleUrl}`)

	const response = await fetch(bundleUrl)
	if (!response.ok) {
		throw new Error(
			`Failed to download bundle: ${response.status} ${response.statusText}`,
		)
	}

	const buffer = Buffer.from(await response.arrayBuffer())
	fs.writeFileSync(destinationPath, buffer)

	verbose(`Bundle downloaded to: ${destinationPath}`)
}

/**
 * Extracts a .mcpb bundle using the @anthropic/mcpb CLI
 */
async function extractBundle(
	mcpbPath: string,
	extractDir: string,
): Promise<void> {
	verbose(`Extracting bundle to: ${extractDir}`)

	return new Promise((resolve, reject) => {
		const proc = spawn(
			"npx",
			["-y", "@anthropic-ai/mcpb", "unpack", mcpbPath, extractDir],
			{
				stdio: "pipe",
			},
		)

		let stderr = ""
		proc.stderr?.on("data", (data) => {
			stderr += data.toString()
		})

		proc.on("close", (code) => {
			if (code === 0) {
				verbose("Bundle extracted successfully")
				resolve()
			} else {
				reject(new Error(`Failed to extract bundle: ${stderr}`))
			}
		})

		proc.on("error", (error) => {
			reject(new Error(`Failed to spawn mcpb CLI: ${error.message}`))
		})
	})
}

/**
 * Downloads and extracts a bundle to the local cache
 * @param qualifiedName - Server qualified name (e.g., @user/server)
 * @param bundleUrl - URL to download the .mcpb bundle from
 * @returns Path to the extracted bundle directory
 */
export async function downloadAndExtractBundle(
	qualifiedName: string,
	bundleUrl: string,
): Promise<string> {
	const bundleDir = getBundleDir(qualifiedName)

	// Create bundle directory
	fs.mkdirSync(bundleDir, { recursive: true })

	// Download bundle
	const mcpbPath = path.join(bundleDir, BUNDLE_FILENAME)
	await downloadBundle(bundleUrl, mcpbPath)

	// Extract bundle using @anthropic/mcpb CLI
	await extractBundle(mcpbPath, bundleDir)

	// Clean up mcpb file
	fs.unlinkSync(mcpbPath)

	return bundleDir
}

/**
 * Ensures a bundle is installed locally, downloading if necessary
 * Returns the path to the bundle directory
 */
export async function ensureBundleInstalled(
	qualifiedName: string,
	bundleUrl: string,
): Promise<string> {
	// Check if already cached
	if (isBundleCached(qualifiedName)) {
		verbose(`Bundle ${qualifiedName} already cached`)
		return getBundleDir(qualifiedName)
	}

	// Download and extract
	verbose(`Bundle ${qualifiedName} not found, downloading...`)
	return await downloadAndExtractBundle(qualifiedName, bundleUrl)
}

/**
 * Gets the entrypoint path within a bundle based on runtime
 * @param bundleDir - Directory containing the extracted bundle
 * @param runtime - Runtime type (node)
 * @returns Path to the executable file
 */
/**
 * Gets command and args from bundle manifest
 * @param bundleDir - Directory containing the extracted bundle
 * @returns Command and args from manifest
 */
export function getBundleCommand(bundleDir: string): {
	command: string
	args: string[]
} {
	const manifestPath = path.join(bundleDir, "manifest.json")
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`Bundle manifest not found: ${manifestPath}`)
	}

	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
	const mcpConfig = manifest.server?.mcp_config

	if (!mcpConfig?.command) {
		throw new Error("Bundle manifest missing server.mcp_config.command")
	}

	const args = (mcpConfig.args || []).map((arg: string) =>
		arg.replace(/\$\{__dirname\}/g, bundleDir),
	)

	return {
		command: mcpConfig.command,
		args,
	}
}

export function getBundleEntrypoint(
	bundleDir: string,
	_runtime: string = "node",
): string {
	// Read entry point from manifest.json
	const manifestPath = path.join(bundleDir, "manifest.json")
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`Bundle manifest not found: ${manifestPath}`)
	}

	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
	if (!manifest.server?.entry_point) {
		throw new Error("Bundle manifest missing server.entry_point")
	}

	return path.join(bundleDir, manifest.server.entry_point)
}
