import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import {
	type McpbUserConfigurationOption,
	unpackExtension,
} from "@anthropic-ai/mcpb"
import type { JSONSchema } from "../types/registry.js"
import { verbose } from "./logger.js"

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
function getServerCacheDir(qualifiedName: string): string {
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
function getBundleDir(qualifiedName: string): string {
	return path.join(getServerCacheDir(qualifiedName), "current")
}

/**
 * Checks if a bundle is cached locally
 */
function isBundleCached(qualifiedName: string): boolean {
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
 * Downloads and extracts a bundle to the local cache
 * @param qualifiedName - Server qualified name (e.g., @user/server)
 * @param bundleUrl - URL to download the .mcpb bundle from
 * @returns Path to the extracted bundle directory
 */
async function downloadAndExtractBundle(
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
	verbose(`Extracting bundle to: ${bundleDir}`)
	const success = await unpackExtension({
		mcpbPath,
		outputDir: bundleDir,
		silent: true,
	})

	if (!success) {
		throw new Error("Failed to extract bundle")
	}

	verbose("Bundle extracted successfully")

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
 * Reads manifest and hydrates all templates in a bundle command
 * @param bundleDir - Directory containing the extracted bundle (must already be installed)
 * @param userConfig - User configuration values for template resolution
 * @returns Fully hydrated bundle command ready to execute
 */
export function getHydratedBundleCommand(
	bundleDir: string,
	userConfig: Record<string, unknown>,
): {
	command: string
	args: string[]
	env: Record<string, string>
} {
	const bundleCommand = getBundleCommand(bundleDir)
	return hydrateBundleCommand(bundleCommand, userConfig, bundleDir)
}

/**
 * Hydrates a bundle command by resolving all template strings in args and env
 * @param bundleCommand - Bundle command from getBundleCommand (may contain templates)
 * @param userConfig - User configuration values for ${user_config.*} templates
 * @param bundleDir - Bundle directory for ${__dirname} resolution
 * @returns Fully hydrated bundle command with all templates resolved
 */
export function hydrateBundleCommand(
	bundleCommand: {
		command: string
		args: string[]
		env?: Record<string, string>
	},
	userConfig: Record<string, unknown>,
	bundleDir: string,
): {
	command: string
	args: string[]
	env: Record<string, string>
} {
	const resolvedArgs = bundleCommand.args.map((arg) =>
		resolveTemplateString(arg, userConfig, bundleDir),
	)

	const resolvedEnv: Record<string, string> = {}
	if (bundleCommand.env) {
		for (const [key, value] of Object.entries(bundleCommand.env)) {
			resolvedEnv[key] = resolveTemplateString(value, userConfig, bundleDir)
		}
	}

	return {
		command: bundleCommand.command,
		args: resolvedArgs,
		env: resolvedEnv,
	}
}

/**
 * Resolves a single template string
 * @param template - Template string like "${user_config.apiKey}" or "${__dirname}"
 * @param userConfig - User configuration values
 * @param bundleDir - Bundle directory for __dirname resolution
 * @returns Resolved string
 */
function resolveTemplateString(
	template: string,
	userConfig: Record<string, unknown>,
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
			let value: unknown = userConfig

			for (const part of parts) {
				if (
					value &&
					typeof value === "object" &&
					!Array.isArray(value) &&
					value !== null
				) {
					value = (value as Record<string, unknown>)[part]
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

/**
 * Gets command and args from bundle manifest
 * @param bundleDir - Directory containing the extracted bundle
 * @returns Command and args from manifest
 */
export function getBundleCommand(bundleDir: string): {
	command: string
	args: string[]
	env?: Record<string, string>
} {
	const manifestPath = path.join(bundleDir, "manifest.json")
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`Bundle manifest not found: ${manifestPath}`)
	}

	const manifestContent = fs.readFileSync(manifestPath, "utf-8")
	if (!manifestContent.trim()) {
		throw new Error(`Bundle manifest is empty: ${manifestPath}`)
	}

	let manifest: {
		server?: {
			mcp_config?: {
				command?: string
				args?: string[]
				env?: Record<string, string>
			}
		}
	}
	try {
		manifest = JSON.parse(manifestContent) as typeof manifest
	} catch (error) {
		throw new Error(
			`Failed to parse bundle manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
	const mcpConfig = manifest.server?.mcp_config

	if (!mcpConfig?.command) {
		throw new Error("Bundle manifest missing server.mcp_config.command")
	}

	// Resolve __dirname in args (user_config templates remain as-is for later resolution)
	const args = (mcpConfig.args || []).map((arg: string) =>
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for fallback
		arg.replace(/\$\{__dirname\}/g, bundleDir || "${__dirname}"),
	)

	// Include env vars if present (raw templates that need resolution later)
	return {
		command: mcpConfig.command,
		args,
		...(mcpConfig.env && { env: mcpConfig.env }),
	}
}

/**
 * Converts flat MCPB user_config format to nested JSONSchema format
 * MCPB format: {"auth.apiKey": {type: "string", required: true}}
 * JSONSchema format: {auth: {apiKey: {type: "string", required: true}}}
 */
export function convertMCPBUserConfigToJSONSchema(
	mcpbUserConfig: Record<string, Partial<McpbUserConfigurationOption>>,
): JSONSchema {
	const schema: JSONSchema = {
		type: "object",
		properties: {},
		required: [],
	}

	// Track which top-level keys have required nested fields
	const topLevelKeys = new Set<string>()
	const requiredFields: string[] = []

	for (const [dotKey, configOption] of Object.entries(mcpbUserConfig)) {
		const parts = dotKey.split(".")
		if (parts.length === 0) continue

		// Get or create nested object structure
		let current: JSONSchema = schema
		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i]
			topLevelKeys.add(part)

			if (!current.properties) {
				current.properties = {}
			}
			if (!current.properties[part]) {
				current.properties[part] = {
					type: "object",
					properties: {},
				}
			}
			current = current.properties[part] as JSONSchema
		}

		// Add the leaf property
		const leafKey = parts[parts.length - 1]
		if (!current.properties) {
			current.properties = {}
		}

		// Handle multiple values (arrays) - when multiple is true, convert to array type
		const jsonSchemaProp: JSONSchema = configOption.multiple
			? {
					type: "array",
					items: {
						type: configOption.type,
					},
					description: configOption.description,
					default: configOption.default,
				}
			: {
					type: configOption.type,
					description: configOption.description,
					default: configOption.default,
				}

		current.properties[leafKey] = jsonSchemaProp

		// Track required fields
		if (configOption.required) {
			if (parts.length === 1) {
				// Top-level required field
				requiredFields.push(leafKey)
			} else {
				// Nested required field - need to ensure parent is required
				const parentKey = parts[0]
				if (!schema.required) {
					schema.required = []
				}
				if (!schema.required.includes(parentKey)) {
					schema.required.push(parentKey)
				}

				// Also mark nested field as required in its parent object
				let parentSchema = schema.properties?.[parentKey] as JSONSchema
				for (let i = 1; i < parts.length - 1; i++) {
					parentSchema = parentSchema.properties?.[parts[i]] as JSONSchema
				}
				if (!parentSchema.required) {
					parentSchema.required = []
				}
				if (!parentSchema.required.includes(leafKey)) {
					parentSchema.required.push(leafKey)
				}
			}
		}
	}

	if (requiredFields.length > 0) {
		schema.required = requiredFields
	}

	return schema
}

/**
 * Extracts user_config schema from bundle manifest and converts to JSONSchema format
 * @param bundleDir - Directory containing the extracted bundle
 * @returns JSONSchema object, or null if user_config not present
 */
export function getBundleUserConfigSchema(
	bundleDir: string,
): JSONSchema | null {
	const manifestPath = path.join(bundleDir, "manifest.json")
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`Bundle manifest not found: ${manifestPath}`)
	}

	const manifestContent = fs.readFileSync(manifestPath, "utf-8")
	if (!manifestContent.trim()) {
		throw new Error(`Bundle manifest is empty: ${manifestPath}`)
	}
	let manifest: {
		user_config?: Record<string, Partial<McpbUserConfigurationOption>>
	}
	try {
		manifest = JSON.parse(manifestContent) as typeof manifest
	} catch (error) {
		throw new Error(
			`Failed to parse bundle manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
	const userConfig = manifest.user_config

	if (!userConfig || typeof userConfig !== "object") {
		verbose(`No user_config found in bundle manifest for ${bundleDir}`)
		return null
	}

	verbose(
		`Found user_config in bundle manifest, converting to JSONSchema format`,
	)
	const jsonSchema = convertMCPBUserConfigToJSONSchema(userConfig)
	return jsonSchema
}
