import { existsSync, readFileSync } from "node:fs"
import chalk from "chalk"
import { z } from "zod"
import type { ServerConfig } from "../types/registry"

// --- Qualified Name Parsing ---

/**
 * Branded type for non-empty namespace strings.
 * Provides compile-time safety that namespace is never empty.
 */
export type Namespace = string & { readonly __brand: "Namespace" }

/**
 * Type guard to check if a string is a valid non-empty namespace.
 */
export function isValidNamespace(value: string): value is Namespace {
	return value.length > 0
}

export interface ParsedQualifiedName {
	namespace: Namespace
	serverName: string
}

/**
 * Parse a qualified name into namespace and server name parts.
 *
 * @param qualifiedName - The qualified name to parse (e.g., "@foo/bar", "linear")
 * @returns Object with namespace and serverName
 * @throws Error if the qualified name is empty or results in an empty namespace
 */
export function parseQualifiedName(qualifiedName: string): ParsedQualifiedName {
	// Strip @ prefix if present
	const normalized = qualifiedName.startsWith("@")
		? qualifiedName.slice(1)
		: qualifiedName

	const parts = normalized.split("/")
	const namespace = parts[0]

	if (!isValidNamespace(namespace)) {
		throw new Error("Invalid qualified name: namespace cannot be empty")
	}

	return {
		namespace,
		serverName: parts.length === 2 ? parts[1] : "",
	}
}

// --- Config Masking ---

/**
 * Masks sensitive values in config for safe logging
 * Masks values for keys containing sensitive keywords
 */
export function maskConfig(config: ServerConfig): Record<string, unknown> {
	const masked: Record<string, unknown> = {}
	const sensitiveKeywords = [
		"key",
		"token",
		"secret",
		"password",
		"auth",
		"credential",
		"api",
	]

	for (const [key, value] of Object.entries(config)) {
		const lowerKey = key.toLowerCase()
		const isSensitive = sensitiveKeywords.some((keyword) =>
			lowerKey.includes(keyword),
		)

		if (isSensitive && typeof value === "string" && value.length > 0) {
			masked[key] = "***"
		} else {
			masked[key] = value
		}
	}

	return masked
}

// --- JSON Parsing ---

/**
 * Shared helper for parsing JSON from CLI
 * Handles Windows cmd quirks with single quotes and double JSON parsing
 */
function parseJsonString(input: string): unknown {
	let raw = input
	// Windows cmd does not interpret `'`, passes it literally
	if (raw.startsWith("'") && raw.endsWith("'")) {
		raw = raw.slice(1, -1)
	}
	let parsed = JSON.parse(raw)
	if (typeof parsed === "string") {
		parsed = JSON.parse(parsed)
	}
	return parsed
}

/**
 * Parses server configuration JSON from command line options
 * @param configOption - Raw config string from CLI
 * @returns Parsed ServerConfig object
 * @throws Process exit if parsing fails
 */
export function parseServerConfig(configOption: string): ServerConfig {
	try {
		return parseJsonString(configOption) as ServerConfig
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(chalk.red(`Error parsing config: ${errorMessage}`))
		process.exit(1)
	}
}

const ConfigSchemaSchema = z.record(z.string(), z.unknown())

/**
 * Parses config schema from command line options
 * Supports both inline JSON and file paths (ending in .json)
 * @param input - Raw config schema string or path to .json file
 * @returns Parsed config schema object
 * @throws Process exit if parsing fails
 */
export function parseConfigSchema(input: string): { [key: string]: unknown } {
	try {
		let jsonString: string

		// If it looks like a file path, try to read it
		if (input.endsWith(".json")) {
			if (!existsSync(input)) {
				console.error(chalk.red(`Config schema file not found: ${input}`))
				process.exit(1)
			}
			jsonString = readFileSync(input, "utf-8")
		} else {
			jsonString = input
		}

		const parsed = parseJsonString(jsonString)

		const result = ConfigSchemaSchema.safeParse(parsed)
		if (!result.success) {
			console.error(chalk.red("Invalid config schema: must be a JSON object"))
			process.exit(1)
		}

		return result.data
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(chalk.red(`Error parsing config schema: ${errorMessage}`))
		process.exit(1)
	}
}
