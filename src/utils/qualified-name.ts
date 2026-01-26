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

export interface ParsedQualifiedName {
	namespace: string
	serverName: string
}

/**
 * Parse a qualified name into namespace and server name parts.
 *
 * @param qualifiedName - The qualified name to parse (e.g., "@foo/bar", "linear")
 * @returns Object with namespace and serverName
 */
export function parseQualifiedName(qualifiedName: string): ParsedQualifiedName {
	// Strip @ prefix if present
	const normalized = qualifiedName.startsWith("@")
		? qualifiedName.slice(1)
		: qualifiedName

	const parts = normalized.split("/")

	return {
		namespace: parts[0],
		serverName: parts.length === 2 ? parts[1] : "",
	}
}
