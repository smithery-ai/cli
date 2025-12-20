import type { ConnectionInfo } from "@smithery/registry/models/components"
import type ora from "ora"
import type { JSONSchema, ServerConfig } from "../types/registry"
import { promptForExistingConfig } from "../utils/command-prompts"
import {
	collectConfigValues,
	validateAndFormatConfig,
} from "../utils/session-config"
import {
	ensureBundleInstalled,
	getBundleUserConfigSchema,
} from "./bundle-manager"
import { getConfig } from "./keychain"
import { verbose } from "./logger"

// Type for ora spinner instance
export type OraSpinner = ReturnType<ReturnType<typeof ora>["start"]>

// Helper function to get config schema (from connection or bundle)
async function getConfigSchema(
	connection: ConnectionInfo,
	qualifiedName: string,
): Promise<ConnectionInfo["configSchema"] | undefined> {
	let configSchema = connection.configSchema || undefined
	if (connection.bundleUrl) {
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
	connection: ConnectionInfo,
	qualifiedName: string,
): Promise<ConnectionInfo> {
	const configSchema = await getConfigSchema(connection, qualifiedName)
	return {
		...connection,
		...(configSchema && { configSchema }),
	}
}

// Helper function to check if server needs config
export async function serverNeedsConfig(
	connection: ConnectionInfo,
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
	connection: ConnectionInfo,
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
				await validateAndFormatConfig(connectionWithSchema, mergedConfig)
				return mergedConfig
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
			await validateAndFormatConfig(connectionWithSchema, existingConfig)
			return existingConfig
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
			await validateAndFormatConfig(connectionWithSchema, configValues)
			return configValues
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
	connection: ConnectionInfo,
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
			await validateAndFormatConfig(connectionWithSchema, configValues)
			return configValues
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
	await validateAndFormatConfig(connectionWithSchema, config)
	return config
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
	connection: ConnectionInfo,
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
