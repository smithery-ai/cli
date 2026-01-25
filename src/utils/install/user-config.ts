import type { ServerGetResponse } from "@smithery/api/resources/servers/servers"

type Connection =
	| ServerGetResponse.StdioConnection
	| ServerGetResponse.HTTPConnection

import type ora from "ora"
import { getConfig } from "../../lib/keychain"
import { verbose } from "../../lib/logger"
import {
	ensureBundleInstalled,
	getBundleUserConfigSchema,
} from "../../lib/mcpb"
import type { JSONSchema, ServerConfig } from "../../types/registry"
import { promptForExistingConfig } from "../command-prompts"
import { collectConfigValues } from "./prompt-user-config.js"

// Type for ora spinner instance
export type OraSpinner = ReturnType<ReturnType<typeof ora>["start"]>

/**
 * Converts a value to the specified type
 * @param value - The value to convert
 * @param type - The target type (boolean, number, integer, array, etc.)
 * @returns The converted value
 */
function convertValueToType(value: unknown, type: string | undefined): unknown {
	if (!type) return value

	// Helper for throwing standardized errors
	const invalid = (expected: string) => {
		throw new Error(`Invalid ${expected} value: ${JSON.stringify(value)}`)
	}

	switch (type) {
		case "boolean": {
			const str = String(value).toLowerCase()
			if (str === "true") return true
			if (str === "false") return false
			invalid("boolean")
			break
		}
		case "number": {
			const num = Number(value)
			if (!Number.isNaN(num)) return num
			invalid("number")
			break
		}
		case "integer": {
			const num = Number.parseInt(String(value), 10)
			if (!Number.isNaN(num)) return num
			invalid("integer")
			break
		}
		case "string":
			return String(value)
		case "array":
			return Array.isArray(value)
				? value
				: String(value)
						.split(",")
						.map((v) => v.trim())
		default:
			return value
	}
}

/**
 * Formats and validates configuration values according to the connection's schema
 *
 * This function:
 * 1. Ensures all required fields are present (throws error if not)
 * 2. Fills empty fields with defaults if available (applies to both required and optional fields)
 * 3. Omits empty optional fields without defaults
 *
 * @param connection - Server connection details containing the config schema
 * @param configValues - Optional existing configuration values to format
 * @returns Formatted configuration values with proper types according to schema
 * @throws Error if any required config values are missing
 */
export async function validateAndFormatConfig(
	connection: Connection,
	configValues?: ServerConfig,
): Promise<ServerConfig> {
	const configSchema = connection.configSchema as JSONSchema | undefined
	if (!configSchema?.properties) {
		return configValues || {}
	}

	const required = new Set<string>(configSchema.required || [])
	const formattedValues: ServerConfig = {}
	const missingRequired: string[] = []
	const validationErrors: Array<{ field: string; error: string }> = []

	for (const [key, prop] of Object.entries(configSchema.properties)) {
		const schemaProp = prop as JSONSchema
		const value = configValues?.[key]

		try {
			const processedValue = value === "" ? undefined : value
			const finalValue =
				processedValue !== undefined ? processedValue : schemaProp.default

			// Handle required fields
			if (required.has(key)) {
				if (finalValue === undefined) {
					missingRequired.push(key)
					continue
				}
			}

			// Skip optional fields with no value (even if they have defaults)
			// Defaults should be applied at runtime, not stored in the registry
			if (processedValue === undefined) {
				continue
			}

			// Convert and include the value (only user-provided values)
			formattedValues[key] = convertValueToType(finalValue, schemaProp.type)
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown validation error"
			validationErrors.push({ field: key, error: errorMessage })
			if (required.has(key)) {
				missingRequired.push(key)
			}
		}
	}

	// Combine all validation errors into a single error message
	if (validationErrors.length > 0 || missingRequired.length > 0) {
		const errorMessages: string[] = []

		if (missingRequired.length > 0) {
			errorMessages.push(
				`Missing required config values: ${missingRequired.join(", ")}`,
			)
		}

		if (validationErrors.length > 0) {
			errorMessages.push(
				"Validation errors:",
				...validationErrors.map(({ field, error }) => `  ${field}: ${error}`),
			)
		}

		throw new Error(errorMessages.join("\n"))
	}

	return formattedValues
}

// Helper function to get config schema (from connection or bundle)
async function getConfigSchema(
	connection: Connection,
	qualifiedName: string,
): Promise<JSONSchema | undefined> {
	let configSchema = connection.configSchema as JSONSchema | undefined
	if ("bundleUrl" in connection && connection.bundleUrl) {
		verbose("Downloading bundle to extract user_config schema...")
		const bundleDir = await ensureBundleInstalled(
			qualifiedName,
			connection.bundleUrl,
		)
		const bundleSchema = getBundleUserConfigSchema(bundleDir)
		if (bundleSchema) {
			configSchema = bundleSchema
		}
	}
	return configSchema
}

// Helper function to create connection with schema
async function createConnectionWithSchema(
	connection: Connection,
	qualifiedName: string,
): Promise<Connection> {
	const configSchema = await getConfigSchema(connection, qualifiedName)
	return {
		...connection,
		...(configSchema && {
			configSchema: configSchema as { [key: string]: unknown },
		}),
	} as Connection
}

// Helper function to check if server needs config
export async function serverNeedsConfig(
	connection: Connection,
	qualifiedName: string,
): Promise<boolean> {
	const configSchema = await getConfigSchema(connection, qualifiedName)
	return !!(
		configSchema?.properties && Object.keys(configSchema.properties).length > 0
	)
}

// Handle keychain found scenario
// Always prompt "use existing or provide new" when keychain exists
async function handleKeychainFound(
	connection: Connection,
	qualifiedName: string,
	configValues: ServerConfig,
	spinner: OraSpinner,
): Promise<ServerConfig> {
	const existingConfig = await getConfig(qualifiedName)
	if (!existingConfig) {
		throw new Error("Expected existing config but none found")
	}

	const connectionWithSchema = await createConnectionWithSchema(
		connection,
		qualifiedName,
	)

	spinner.stop()
	const useExisting = await promptForExistingConfig()

	if (useExisting) {
		verbose("Using existing configuration from keychain")
		spinner.start()

		// If --config provided, merge --config over keychain (--config wins)
		if (Object.keys(configValues).length > 0) {
			const mergedConfig = { ...existingConfig, ...configValues }
			// Validate merged config
			try {
				return await validateAndFormatConfig(connectionWithSchema, mergedConfig)
			} catch (_error) {
				// Validation failed - prompt for invalid/missing required fields
				verbose("Merged config validation failed, prompting for invalid fields")
				spinner.stop()
				const fixedConfig = await collectConfigValues(
					connectionWithSchema,
					mergedConfig,
				)
				spinner.start()
				// collectConfigValues validates internally, so we can return the fixed config
				return fixedConfig
			}
		}

		// No --config - validate existing config
		try {
			return await validateAndFormatConfig(connectionWithSchema, existingConfig)
		} catch (_error) {
			// Validation failed - prompt for invalid/missing required fields
			verbose("Existing config validation failed, prompting for invalid fields")
			spinner.stop()
			const fixedConfig = await collectConfigValues(
				connectionWithSchema,
				existingConfig,
			)
			spinner.start()
			// collectConfigValues validates internally, so we can return the fixed config
			return fixedConfig
		}
	}

	// User chose to provide new configuration
	verbose("User chose to provide new configuration")
	spinner.start()

	// If --config provided, use it as base (ignore keychain)
	if (Object.keys(configValues).length > 0) {
		// Validate --config
		try {
			return await validateAndFormatConfig(connectionWithSchema, configValues)
		} catch (_error) {
			// Validation failed - prompt for invalid/missing required fields
			verbose("--config validation failed, prompting for invalid fields")
			spinner.stop()
			const fixedConfig = await collectConfigValues(
				connectionWithSchema,
				configValues,
			)
			spinner.start()
			return fixedConfig
		}
	}

	// No --config, collect fresh
	spinner.stop()
	const config = await collectConfigValues(connectionWithSchema, {})
	spinner.start()
	return config
}

// Handle no keychain scenario
async function handleNoKeychain(
	connection: Connection,
	qualifiedName: string,
	configValues: ServerConfig,
	spinner: OraSpinner,
): Promise<ServerConfig> {
	const connectionWithSchema = await createConnectionWithSchema(
		connection,
		qualifiedName,
	)

	// If --config provided, use it as base
	if (Object.keys(configValues).length > 0) {
		// Validate --config
		try {
			return await validateAndFormatConfig(connectionWithSchema, configValues)
		} catch (_error) {
			// Validation failed - prompt for invalid/missing required fields
			verbose("--config validation failed, prompting for invalid fields")
			spinner.stop()
			const fixedConfig = await collectConfigValues(
				connectionWithSchema,
				configValues,
			)
			spinner.start()
			return fixedConfig
		}
	}

	// No --config, collect fresh
	spinner.stop()
	const config = await collectConfigValues(connectionWithSchema, {})
	spinner.start()
	return await validateAndFormatConfig(connectionWithSchema, config)
}

export function applySchemaDefaults(
	config: ServerConfig,
	configSchema: JSONSchema | undefined,
): ServerConfig {
	if (!configSchema?.properties) {
		return config
	}
	const required = new Set<string>(configSchema.required || [])
	const enriched = { ...config }
	for (const [key, prop] of Object.entries(configSchema.properties)) {
		if (key in enriched || required.has(key)) continue
		if (prop.default !== undefined) enriched[key] = prop.default
	}
	return enriched
}

// Public API: Resolve user configuration based on connection, qualified name, and provided config values
// Follows the principle: always prompt for keychain if found, regardless of --config
export async function resolveUserConfig(
	connection: Connection,
	qualifiedName: string,
	configValues: ServerConfig,
	spinner: OraSpinner,
): Promise<ServerConfig> {
	// 1. Check if server needs config
	const needsConfig = await serverNeedsConfig(connection, qualifiedName)
	if (!needsConfig) {
		verbose("Server does not require configuration")
		return {}
	}

	// 2. Always check keychain first
	const existingConfig = await getConfig(qualifiedName)
	let config: ServerConfig

	if (existingConfig) {
		// Keychain exists - always prompt "use existing or provide new" (even if invalid)
		config = await handleKeychainFound(
			connection,
			qualifiedName,
			configValues,
			spinner,
		)
	} else {
		// No keychain - handle --config or collect fresh
		config = await handleNoKeychain(
			connection,
			qualifiedName,
			configValues,
			spinner,
		)
	}

	// 3. Apply schema defaults at the end
	const configSchema = await getConfigSchema(connection, qualifiedName)
	return applySchemaDefaults(config, configSchema)
}
