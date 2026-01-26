/**
 * Utilities for parsing qualified server names.
 *
 * Qualified names follow the format: [@]namespace/serverName or just serverName
 * Examples:
 *   - "@smithery/github" -> { namespace: "smithery", serverName: "github" }
 *   - "smithery/github"  -> { namespace: "smithery", serverName: "github" }
 *   - "linear"           -> { namespace: "", serverName: "linear" }
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
 * @throws Error if the qualified name is empty
 */
export function parseQualifiedName(qualifiedName: string): ParsedQualifiedName {
	if (!qualifiedName) {
		throw new Error("Invalid qualified name: cannot be empty")
	}

	// Strip @ prefix if present
	const normalized = qualifiedName.startsWith("@")
		? qualifiedName.slice(1)
		: qualifiedName

	const parts = normalized.split("/")

	// Two segments: namespace/serverName
	// Single segment: just serverName (no namespace)
	if (parts.length === 2) {
		return {
			namespace: parts[0],
			serverName: parts[1],
		}
	}

	return {
		namespace: "",
		serverName: normalized,
	}
}
