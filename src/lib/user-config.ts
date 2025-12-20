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

// Discriminated union type for config strategies
export type ConfigStrategy =
	| "skipConfig"
	| "useProvidedConfig"
	| "promptUseKeychain"
	| "promptNewConfig"

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

// Determine which config strategy to use
export async function resolveConfigStrategy(
	connection: ConnectionInfo,
	qualifiedName: string,
	configValues: ServerConfig,
): Promise<ConfigStrategy> {
	const needsConfig = await serverNeedsConfig(connection, qualifiedName)

	if (!needsConfig) {
		return "skipConfig"
	}

	if (Object.keys(configValues).length > 0) {
		return "useProvidedConfig"
	}

	const existingConfig = await getConfig(qualifiedName)
	if (!existingConfig) {
		return "promptNewConfig"
	}

	// Config exists - validate it
	const connectionWithSchema = await createConnectionWithSchema(
		connection,
		qualifiedName,
	)
	try {
		await validateAndFormatConfig(connectionWithSchema, existingConfig)
		return "promptUseKeychain"
	} catch {
		return "promptNewConfig"
	}
}

// Handler for promptUseKeychain strategy
async function handlePromptUseKeychain(
	connection: ConnectionInfo,
	qualifiedName: string,
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
		return existingConfig
	}

	verbose("User chose to provide new configuration")
	const config = await collectConfigValues(connectionWithSchema, {})
	spinner.start()
	return config
}

// Handler for promptNewConfig strategy
async function handlePromptNewConfig(
	connection: ConnectionInfo,
	qualifiedName: string,
	spinner: OraSpinner,
): Promise<ServerConfig> {
	const existingConfig = await getConfig(qualifiedName)
	if (existingConfig) {
		verbose(
			`Existing config validation failed, prompting for new configuration`,
		)
	}
	const connectionWithSchema = await createConnectionWithSchema(
		connection,
		qualifiedName,
	)
	spinner.stop()
	const config = await collectConfigValues(connectionWithSchema, {})
	spinner.start()
	return config
}

function applySchemaDefaults(
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
export async function resolveUserConfig(
	connection: ConnectionInfo,
	qualifiedName: string,
	configValues: ServerConfig,
	spinner: OraSpinner,
): Promise<ServerConfig> {
	const strategy = await resolveConfigStrategy(
		connection,
		qualifiedName,
		configValues,
	)

	let config: ServerConfig
	switch (strategy) {
		case "skipConfig":
			verbose("Server does not require configuration")
			config = {}
			break
		case "useProvidedConfig":
			verbose("Using configuration from --config flag")
			config = configValues
			break
		case "promptUseKeychain":
			config = await handlePromptUseKeychain(connection, qualifiedName, spinner)
			break
		case "promptNewConfig":
			config = await handlePromptNewConfig(connection, qualifiedName, spinner)
			break
	}

	const configSchema = await getConfigSchema(connection, qualifiedName)
	return applySchemaDefaults(config, configSchema)
}
