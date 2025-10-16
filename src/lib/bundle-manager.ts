import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { unpackExtension } from "@anthropic-ai/mcpb"
import fetch from "cross-fetch"
import { verbose } from "./logger"

const BUNDLE_FILENAME = "server.mcpb"
const CACHE_META_FILENAME = ".metadata.json"

interface CacheMetadata {
	etag: string | null
	lastModified: string | null
	cachedAt: string
	bundleUrl: string
}

/**
 * Gets the cache directory for a specific server
 */
export function getServerCacheDir(qualifiedName: string): string {
	return path.join(os.homedir(), ".smithery", "cache", "servers", qualifiedName)
}

/**
 * Gets the path to the cache metadata file
 */
function getCacheMetaPath(qualifiedName: string): string {
	return path.join(getBundleDir(qualifiedName), CACHE_META_FILENAME)
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
 * Checks if a bundle needs to be updated by comparing ETags
 * Uses a lightweight HEAD request to avoid downloading the entire bundle
 */
async function needsBundleUpdate(
	qualifiedName: string,
	bundleUrl: string,
): Promise<boolean> {
	const cacheMetaPath = getCacheMetaPath(qualifiedName)

	// If no metadata exists, bundle needs to be downloaded
	if (!fs.existsSync(cacheMetaPath)) {
		verbose(`No cache metadata found for ${qualifiedName}`)
		return true
	}

	try {
		// Make a HEAD request to get ETag without downloading the file
		verbose(`Checking for updates: ${bundleUrl}`)
		const response = await fetch(bundleUrl, { method: "HEAD" })

		if (!response.ok) {
			verbose(`HEAD request failed: ${response.status} ${response.statusText}`)
			return true // If HEAD fails, try to download
		}

		const remoteETag = response.headers.get("etag")
		const remoteLastModified = response.headers.get("last-modified")

		// Read cached metadata
		const cached: CacheMetadata = JSON.parse(
			fs.readFileSync(cacheMetaPath, "utf-8"),
		)

		// Compare ETags first (most reliable)
		if (remoteETag && cached.etag) {
			if (cached.etag === remoteETag) {
				verbose(`Bundle ${qualifiedName} is up-to-date (ETag: ${remoteETag})`)
				return false // No update needed
			}
			verbose(
				`Bundle ${qualifiedName} has updates (ETag changed: ${cached.etag} → ${remoteETag})`,
			)
			return true
		}

		// Fallback to Last-Modified if ETag not available
		if (remoteLastModified && cached.lastModified) {
			if (cached.lastModified === remoteLastModified) {
				verbose(
					`Bundle ${qualifiedName} is up-to-date (Last-Modified: ${remoteLastModified})`,
				)
				return false
			}
			verbose(`Bundle ${qualifiedName} has updates (Last-Modified changed)`)
			return true
		}

		// If neither ETag nor Last-Modified available, download to be safe
		verbose(`No cache headers found, will download bundle`)
		return true
	} catch (error) {
		verbose(`Error checking for updates: ${error}`)
		return true // On error, try to download
	}
}

/**
 * Downloads a bundle file from a URL and returns the response for metadata extraction
 */
async function downloadBundle(
	bundleUrl: string,
	destinationPath: string,
): Promise<{ etag: string | null; lastModified: string | null }> {
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

	// Return cache headers for metadata
	return {
		etag: response.headers.get("etag"),
		lastModified: response.headers.get("last-modified"),
	}
}

/**
 * Extracts a .mcpb bundle using the @anthropic-ai/mcpb library
 */
async function extractBundle(
	mcpbPath: string,
	extractDir: string,
): Promise<void> {
	verbose(`Extracting bundle to: ${extractDir}`)

	const success = await unpackExtension({
		mcpbPath,
		outputDir: extractDir,
		silent: true,
	})

	if (!success) {
		throw new Error("Failed to extract bundle")
	}

	verbose("Bundle extracted successfully")
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
	const { etag, lastModified } = await downloadBundle(bundleUrl, mcpbPath)

	// Extract bundle using @anthropic/mcpb CLI
	await extractBundle(mcpbPath, bundleDir)

	// Save cache metadata for future ETag comparisons
	const cacheMetadata: CacheMetadata = {
		etag,
		lastModified,
		cachedAt: new Date().toISOString(),
		bundleUrl,
	}
	const cacheMetaPath = getCacheMetaPath(qualifiedName)
	fs.writeFileSync(cacheMetaPath, JSON.stringify(cacheMetadata, null, 2))
	verbose(`Cache metadata saved for ${qualifiedName}`)

	// Clean up mcpb file
	fs.unlinkSync(mcpbPath)

	return bundleDir
}

/**
 * Ensures a bundle is installed locally, downloading if necessary
 * Uses ETag-based caching to efficiently check for updates
 * Returns the path to the bundle directory
 */
export async function ensureBundleInstalled(
	qualifiedName: string,
	bundleUrl: string,
): Promise<string> {
	const bundleDir = getBundleDir(qualifiedName)

	// Check if bundle is cached locally
	if (isBundleCached(qualifiedName)) {
		verbose(`Bundle ${qualifiedName} found in cache`)

		// Check if bundle needs update using lightweight HEAD request
		const needsUpdate = await needsBundleUpdate(qualifiedName, bundleUrl)

		if (!needsUpdate) {
			verbose(`Using cached bundle for ${qualifiedName}`)
			return bundleDir
		}

		verbose(`Updating bundle ${qualifiedName}...`)
	} else {
		verbose(`Bundle ${qualifiedName} not found, downloading...`)
	}

	// Download and extract (either first time or update needed)
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
/**
 * Resolves template strings in environment variables
 * @param env - Environment variables with template strings
 * @param userConfig - User configuration values
 * @param bundleDir - Bundle directory for __dirname resolution
 * @returns Resolved environment variables
 */
export function resolveEnvTemplates(
	env: Record<string, string>,
	userConfig: Record<string, any> = {},
	bundleDir?: string,
): Record<string, string> {
	const resolved: Record<string, string> = {}

	for (const [key, value] of Object.entries(env)) {
		resolved[key] = resolveTemplateString(value, userConfig, bundleDir)
	}

	return resolved
}

/**
 * Resolves a single template string
 * @param template - Template string like "${user_config.apiKey}" or "${__dirname}"
 * @param userConfig - User configuration values
 * @param bundleDir - Bundle directory for __dirname resolution
 * @returns Resolved string
 */
export function resolveTemplateString(
	template: string,
	userConfig: Record<string, any>,
	bundleDir?: string,
): string {
	return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
		// Handle __dirname replacement
		if (path === "__dirname" && bundleDir) {
			return bundleDir
		}

		// Handle user_config paths like "user_config.apiKey"
		if (path.startsWith("user_config.")) {
			const configPath = path.replace("user_config.", "")
			const parts = configPath.split(".")
			let value: any = userConfig

			for (const part of parts) {
				if (value && typeof value === "object") {
					value = value[part]
				} else {
					// If path doesn't exist in userConfig, return the original template
					return match
				}
			}

			// If value exists and is not null/undefined, return it as string
			// Otherwise return the original template
			return value != null ? String(value) : match
		}

		// For other template patterns, return as-is (could be extended for more patterns)
		return match
	})
}

export function getBundleCommand(bundleDir: string): {
	command: string
	args: string[]
	env?: Record<string, string>
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

	// Resolve __dirname in args (user_config templates remain as-is for later resolution)
	const args = (mcpConfig.args || []).map((arg: string) =>
		arg.replace(/\$\{__dirname\}/g, bundleDir || "${__dirname}"),
	)

	// Include env vars if present (raw templates that need resolution later)
	const env = mcpConfig.env

	return {
		command: mcpConfig.command,
		args,
		env,
	}
}

export function getBundleEntrypoint(
	bundleDir: string,
	_runtime = "node",
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
