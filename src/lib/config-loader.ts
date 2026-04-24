import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import * as YAML from "yaml"
import { z } from "zod"

export interface ProjectConfig {
	name?: string
	target?: "local" | "remote"
	runtime?: string
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

const ProjectConfigSchema = z
	.object({
		name: ServerNameSchema.optional(),
		target: z.enum(["local", "remote"]).optional(),
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
