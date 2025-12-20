import type { ConnectionInfo } from "@smithery/registry/models/components"
import type ora from "ora"
import type { ServerConfig } from "../types/registry"
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
	spinner.start()

	if (useExisting) {
		verbose("Using existing configuration from keychain")
		return existingConfig
	}

	verbose("User chose to provide new configuration")
	return await collectConfigValues(connectionWithSchema, {})
}

// Handler for promptNewConfig strategy
async function handlePromptNewConfig(
	connection: ConnectionInfo,
	qualifiedName: string,
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
	return await collectConfigValues(connectionWithSchema, {})
}

// Route to appropriate handler based on strategy
async function handleConfigStrategy(
	strategy: ConfigStrategy,
	connection: ConnectionInfo,
	qualifiedName: string,
	configValues: ServerConfig,
	spinner: OraSpinner,
): Promise<ServerConfig> {
	switch (strategy) {
		case "skipConfig":
			verbose("Server does not require configuration")
			return {}
		case "useProvidedConfig":
			verbose("Using configuration from --config flag")
			return configValues
		case "promptUseKeychain":
			return await handlePromptUseKeychain(connection, qualifiedName, spinner)
		case "promptNewConfig":
			return await handlePromptNewConfig(connection, qualifiedName)
	}
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
	return await handleConfigStrategy(
		strategy,
		connection,
		qualifiedName,
		configValues,
		spinner,
	)
}
