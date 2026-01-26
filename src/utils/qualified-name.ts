/**
 * Utilities for parsing qualified server names.
 *
 * Qualified names follow the format: [@]namespace[/serverName]
 * Examples:
 *   - "@smithery/github" -> { namespace: "smithery", serverName: "github" }
 *   - "smithery/github"  -> { namespace: "smithery", serverName: "github" }
 *   - "linear"           -> { namespace: "linear", serverName: "" }
 *   - "@linear"          -> { namespace: "linear", serverName: "" }
 */

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
