import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import * as YAML from "yaml"
import { z } from "zod"

export interface ProjectConfig {
	name?: string
	target?: "local" | "remote"
	runtime?: string
	build?: {
		installCommand?: string
		buildCommand?: string
		outputDirectory?: string
		assets?: string[]
	}
}

/**
 * Get the entry point from package.json or provided entry point
 */
export function resolveEntryPoint(providedEntry?: string): string {
	if (providedEntry) {
		const resolvedPath = resolve(process.cwd(), providedEntry)
		if (!existsSync(resolvedPath)) {
			throw new Error(`Entry file not found at ${resolvedPath}`)
		}
		return resolvedPath
	}

	// Try package.json "module" field
	const packageJsonPath = resolve(process.cwd(), "package.json")
	if (existsSync(packageJsonPath)) {
		try {
			const packageContent = readFileSync(packageJsonPath, "utf-8")
			const packageJson = JSON.parse(packageContent)

			if (packageJson.module && typeof packageJson.module === "string") {
				const resolvedPath = resolve(process.cwd(), packageJson.module)
				if (existsSync(resolvedPath)) {
					return resolvedPath
				}
				throw new Error(
					`Entry file specified in package.json not found at ${resolvedPath}.\n` +
						"Check that the file exists or update your package.json",
				)
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found at")) {
				throw error
			}
			// package.json parse error or missing module field — fall through to convention
		}
	}

	// Convention fallback: src/index.ts
	const conventionPath = resolve(process.cwd(), "src/index.ts")
	if (existsSync(conventionPath)) {
		return conventionPath
	}

	throw new Error(
		"No entry point found. Provide one of:\n" +
			"  1. An explicit entry file: smithery build ./server.ts\n" +
			'  2. A "module" field in package.json\n' +
			"  3. A file at src/index.ts",
	)
}

// Server name validation schema - aligned with create server action (IDENTIFIER_REGEX)
// Rules: must start with a letter, can contain letters, numbers, hyphens, underscores
// Length: 3-39 characters (1 initial letter + 2-38 following chars)
const ServerNameSchema = z
	.string()
	.regex(
		/^[a-zA-Z][a-zA-Z0-9-_]{2,38}$/,
		"Server name must be 3-39 characters, start with a letter, and contain only letters, numbers, hyphens, or underscores.",
	)

const BuildConfigSchema = z
	.object({
		installCommand: z.string().optional(),
		buildCommand: z.string().optional(),
		outputDirectory: z.string().optional(),
		assets: z.array(z.string()).optional(),
	})
	.optional()

const ProjectConfigSchema = z
	.object({
		name: ServerNameSchema.optional(),
		target: z.enum(["local", "remote"]).optional(),
		build: BuildConfigSchema,
	})
	.loose() satisfies z.ZodType<ProjectConfig>

/**
 * Load and parse smithery.yaml from the current working directory
 * @returns Parsed project config or null if file doesn't exist or is invalid
 */
export function loadProjectConfig(): ProjectConfig | null {
	const configPath = join(process.cwd(), "smithery.yaml")

	if (!existsSync(configPath)) {
		return null
	}

	try {
		const fileContent = readFileSync(configPath, "utf-8")
		const parsed = YAML.parse(fileContent)

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return null
		}

		const result = ProjectConfigSchema.safeParse(parsed)
		if (!result.success) {
			return null
		}

		return result.data
	} catch {
		// File read error, invalid YAML, or validation error - return null
		return null
	}
}
