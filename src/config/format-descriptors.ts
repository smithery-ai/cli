/**
 * Standard field names for STDIO server configurations
 */
export type StdioStandardFields = "command" | "args" | "env"

/**
 * Standard field names for HTTP server configurations
 */
export type HttpStandardFields = "type" | "url" | "headers" | "oauth"

/**
 * Field mappings: maps standard field names to client-specific field names
 */
export interface FieldMappings {
	stdio?: Partial<Record<StdioStandardFields, string>>
	http?: Partial<Record<HttpStandardFields, string>>
}

/**
 * Format descriptor defining how to transform between client-specific and standard formats
 */
export interface FormatDescriptor {
	// Top-level key name (defaults to "mcpServers")
	topLevelKey: string

	// Field mappings: standard field name -> client field name
	fieldMappings?: FieldMappings

	// Type transformations
	typeTransformations?: {
		stdio?: {
			// Type value to use for STDIO (or null to omit type field)
			typeValue: string | null // e.g., "stdio" for goose, "local" for opencode, null for standard
		}
		http?: {
			// Type value to use for HTTP
			typeValue: string // e.g., "http", "streamableHttp", "remote"
		}
	}

	// Structure transformations
	structureTransformations?: {
		stdio?: {
			// How command is stored: "string" or "array"
			commandFormat: "string" | "array" // "array" for opencode (command + args combined)
		}
	}
}

/**
 * Format descriptors registry mapping client names to their format specifications
 */
export const FORMAT_DESCRIPTORS: Record<string, FormatDescriptor> = {
	goose: {
		topLevelKey: "extensions",
		fieldMappings: {
			stdio: { command: "cmd", env: "envs" },
		},
		typeTransformations: {
			stdio: { typeValue: "stdio" },
		},
	},
	opencode: {
		topLevelKey: "mcp",
		fieldMappings: {
			stdio: { env: "environment" },
		},
		typeTransformations: {
			stdio: { typeValue: "local" },
			http: { typeValue: "remote" },
		},
		structureTransformations: {
			stdio: { commandFormat: "array" },
		},
	},
	windsurf: {
		topLevelKey: "mcpServers",
		fieldMappings: {
			http: { url: "serverUrl" },
		},
	},
	cline: {
		topLevelKey: "mcpServers",
		typeTransformations: {
			http: { typeValue: "streamableHttp" },
		},
	},
}

/**
 * Gets format descriptor for a client, falling back to defaults
 * @param clientName - The client name
 * @returns Format descriptor
 */
export function getFormatDescriptor(clientName: string): FormatDescriptor {
	const descriptor = FORMAT_DESCRIPTORS[clientName]
	if (descriptor) {
		return descriptor
	}

	// Default descriptor (standard format)
	return {
		topLevelKey: "mcpServers",
	}
}
