import type { ConnectionDetails } from "../types/registry"
import type { ServerConfig } from "../types/registry"
import inquirer from "inquirer"
import chalk from "chalk"
import type { RegistryServer } from "../types/registry"
import { fetchConfigWithApiKey } from "../registry"

/**
 * Formats and validates configuration values according to the connection's schema
 * 
 * This function processes configuration values to ensure they match the expected types
 * defined in the connection schema. It handles type conversions, applies defaults for
 * non-required fields, and validates that all required fields are present.
 * 
 * @param connection - Server connection details containing the config schema
 * @param configValues - Optional existing configuration values to format
 * @returns Formatted configuration values with proper types according to schema
 * @throws Error if any required config values are missing
 */
export async function formatConfigValues(
	connection: ConnectionDetails,
	configValues?: ServerConfig,
): Promise<ServerConfig> {
	const formattedValues: ServerConfig = {}
	const missingRequired: string[] = []

	if (!connection.configSchema?.properties) {
		return configValues || {}
	}

	const required = new Set<string>(connection.configSchema.required || [])

	// First pass: collect all values and track missing required fields
	for (const [key, prop] of Object.entries(
		connection.configSchema.properties,
	)) {
		const schemaProp = prop as { type?: string; default?: unknown }
		const value = configValues?.[key]

		try {
			let finalValue;
			if (value !== undefined) {
				finalValue = value;
			} else if (!required.has(key)) {
				finalValue = schemaProp.default;
			} else {
				finalValue = undefined;
			}
			
			if (finalValue === undefined) {
				if (required.has(key)) {
					missingRequired.push(key)
					continue
				}
				// Use empty string for optional values without defaults
				formattedValues[key] = ""
				continue
			}

			formattedValues[key] = convertValueToType(finalValue, schemaProp.type)
		} catch (error) {
			if (required.has(key)) {
				missingRequired.push(key)
			} else {
				formattedValues[key] = null // Explicit null for invalid optional values
			}
		}
	}

	// After collecting all values, throw error if any required fields are missing
	if (missingRequired.length > 0) {
		throw new Error(`Missing required config values: ${missingRequired.join(', ')}`)
	}

	return formattedValues
}

/**
 * Converts a value to the specified type
 * @param value - The value to convert
 * @param type - The target type (boolean, number, integer, array, etc.)
 * @returns The converted value
 */
function convertValueToType(value: unknown, type: string | undefined): unknown {
	if (!type) return value;

	// Helper for throwing standardized errors
	const invalid = (expected: string) => {
		throw new Error(`Invalid ${expected} value: ${JSON.stringify(value)}`);
	};

	switch (type) {
		case "boolean": {
			const str = String(value).toLowerCase();
			if (str === "true") return true;
			if (str === "false") return false;
			invalid("boolean");
		}
		case "number": {
			const num = Number(value);
			if (!Number.isNaN(num)) return num;
			invalid("number");
		}
		case "integer": {
			const num = Number.parseInt(String(value), 10);
			if (!Number.isNaN(num)) return num;
			invalid("integer");
		}
		case "string":
			return String(value);
		case "array":
			return Array.isArray(value) ? value : String(value).split(",").map(v => v.trim());
		default:
			return value;
	}
}

/**
 * Validates if saved configuration contains all required values
 * @param connection - Server connection details containing the config schema
 * @param savedConfig - Optional saved configuration to validate
 * @returns Object indicating if config is complete and the validated config
 */
export async function validateConfig(
	connection: ConnectionDetails,
	savedConfig?: ServerConfig
): Promise<{ isValid: boolean; savedConfig?: Record<string, unknown> }> {
	// If no config schema needed, return early
	if (!connection.configSchema?.properties) {
		return { isValid: true, savedConfig: {} };
	}

	try {
		// Always format first to ensure type safety
		const formattedConfig = await formatConfigValues(connection, savedConfig || {});
		
		// Now validate against the formatted config
		const required = new Set<string>(connection.configSchema.required || []);
		const hasAllRequired = Array.from(required).every(
			key => formattedConfig[key] !== undefined
		);

		return {
			isValid: hasAllRequired,
			savedConfig: formattedConfig
		};
	} catch (error) {
		try {
			// Try to get partial config by ignoring required fields
			const partialConfig = Object.fromEntries(
				Object.entries(savedConfig || {})
					.filter(([_, v]) => v !== undefined)
			);
			return { isValid: false, savedConfig: partialConfig };
		} catch {
			// If that fails too, return empty config
			return { isValid: false };
		}
	}
}

/**
 * Collects configuration values from saved config or user input
 * @param connection - Server connection details containing the config schema
 * @param existingValues - Optional existing values to use instead of prompting
 * @param apiKey - Optional API key to fetch saved config from registry
 * @param serverName - Optional server name to fetch saved config
 * @returns Object containing collected config values and validation status
 */
export async function collectConfigValues(
	connection: ConnectionDetails,
	existingValues?: ServerConfig,
	apiKey?: string,
	serverName?: string,
): Promise<{ configValues: ServerConfig; isSavedConfig: boolean }> {
	// 1. Early exit if no config needed
	if (!connection.configSchema?.properties) {
		return { configValues: {}, isSavedConfig: false };
	}

	let baseConfig: ServerConfig = {};

	// 2. Validate and process existing values
	if (existingValues) {
		const { isValid, savedConfig } = await validateConfig(connection, existingValues);
		if (isValid) { // if valid, we return formatted existing config
			return { 
				configValues: savedConfig!,
				isSavedConfig: false // Existing values always count as unsaved
			};
		}
		baseConfig = savedConfig || {};
	}

	let fetchedConfig: ServerConfig = {};
	// let pureSavedConfig = false;

	// 3. Try fetching remote config
	if (apiKey && serverName) {
		try {
			fetchedConfig = await fetchConfigWithApiKey(serverName, apiKey);
			const { isValid, savedConfig } = await validateConfig(connection, fetchedConfig);
			
			if (isValid) {
				// If no existing values, return saved config as is
				if (!existingValues) {
					return {
						configValues: savedConfig!,
						isSavedConfig: true // Pure saved config with no modifications
					};
				}

				// Merge with existing values (existing takes priority)
				const mergedConfig = { ...savedConfig, ...baseConfig };
				const mergedValidation = await validateConfig(connection, mergedConfig);
				
				if (mergedValidation.isValid) {
					return {
						configValues: mergedValidation.savedConfig!,
						isSavedConfig: false // Modified with existing values
					};
				}
				// pureSavedConfig = false;
			}
		} catch (error) {
			console.warn(chalk.yellow("Failed to fetch saved configuration"));
		}
	}

	// 4. If both existing and fetched are invalid, prepare combined base config 
	// and prompt for missing values
	const combinedConfig = { ...baseConfig, ...fetchedConfig };
	const required = new Set<string>(connection.configSchema.required || []);
	const properties = connection.configSchema.properties;

	// 5. Collect missing values
	for (const [key, prop] of Object.entries(properties)) {
		const schemaProp = prop as {
			description?: string;
			default?: unknown;
			type?: string;
		};

		// Skip if value already exists
		if (combinedConfig[key] !== undefined) continue;

		// Prompt for missing value
		const value = await promptForConfigValue(key, schemaProp, required);
		combinedConfig[key] = value !== undefined ? value : schemaProp.default;
	}

	// 6. Final validation and formatting
	try {
		const formatted = await formatConfigValues(connection, combinedConfig);
		return {
			configValues: formatted,
			isSavedConfig: false // True only if pure saved config existed but couldn't be merged
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown configuration error';
		console.error(chalk.red("Configuration error:"), errorMessage);
		return {
			configValues: combinedConfig,
			isSavedConfig: false
		};
	}
}

/**
 * Prompts the user for a config value based on schema property
 * @param key - The configuration key
 * @param schemaProp - The schema property details
 * @param required - Set of required field names
 * @returns The collected value from user input
 */
async function promptForConfigValue(
	key: string,
	schemaProp: {
		description?: string;
		default?: unknown;
		type?: string;
	},
	required: Set<string>
): Promise<unknown> {
	const requiredText = required.has(key) ? chalk.red(" (required)") : " (optional)";
	
	const promptType = key.toLowerCase().includes("key")
		? "password"
		: schemaProp.type === "boolean"
			? "confirm"
			: schemaProp.type === "array"
				? "input"
				: schemaProp.type === "number" || schemaProp.type === "integer"
					? "number"
					: "input";

	const { value } = await inquirer.prompt([
		{
			type: promptType,
			name: "value",
			message: `${schemaProp.description || `Enter value for ${key}`}${requiredText}${
				schemaProp.type === "array" ? " (comma-separated)" : ""
			}`,
			default: schemaProp.default,
			mask: promptType === "password" ? "*" : undefined,
			validate: (input: string | number) => {
				if (required.has(key) && !input) return false;
				if (schemaProp.type === "number" || schemaProp.type === "integer") {
					return !Number.isNaN(Number(input)) || "Please enter a valid number";
				}
				return true;
			},
		},
	]);

	return value;
}

/**
 * Chooses the best stdio connection from available connections
 * @param connections - Array of available connection details
 * @returns The best stdio connection or null if none found
 */
export function chooseStdioConnection(
	connections: ConnectionDetails[],
): ConnectionDetails | null {
	const stdioConnections = connections.filter((conn) => conn.type === "stdio")
	if (!stdioConnections.length) return null

	const priorityOrder = ["npx", "uvx", "docker"]

	/* Try published connections first */
	for (const priority of priorityOrder) {
		const connection = stdioConnections.find(
			(conn) => conn.stdioFunction?.startsWith(priority) && conn.published,
		)
		if (connection) return connection
	}

	/* Try unpublished connections */
	for (const priority of priorityOrder) {
		const connection = stdioConnections.find((conn) =>
			conn.stdioFunction?.startsWith(priority),
		)
		if (connection) return connection
	}

	/* Return first stdio connection if no priority matches */
	return stdioConnections[0]
}

/**
 * Selects the most appropriate connection for a server
 * @param server - The server to choose a connection for
 * @returns The chosen connection details
 * @throws Error if no connection configuration is found
 */
export function chooseConnection(server: RegistryServer): ConnectionDetails {
	if (!server.connections?.length) {
		throw new Error("No connection configuration found")
	}

	/* For local servers, try stdio first */
	if (!server.remote) {
		const stdioConnection = chooseStdioConnection(server.connections)
		if (stdioConnection) return stdioConnection
	}

	/* For remote servers, try WebSocket */
	const wsConnection = server.connections.find((conn) => conn.type === "ws")
	if (wsConnection) return wsConnection

	/* If still no connection found, try stdio again for remote servers */
	const stdioConnection = chooseStdioConnection(server.connections)
	if (stdioConnection) return stdioConnection

	/* Final fallback to first available connection */
	return server.connections[0]
}

/**
 * Converts environment variables to command line arguments
 * @param envVars - Record of environment variables
 * @returns Array of command line arguments
 */
export function envVarsToArgs(envVars: Record<string, string>): string[] {
	return Object.entries(envVars).flatMap(([key, value]) => {
		const argName = key.toLowerCase().replace(/_/g, "-")
		return [`--${argName}`, value]
	})
}

/**
 * Normalizes a server ID by replacing slashes with dashes
 * @param serverId - The server ID to normalize
 * @returns Normalized server ID
 */
export function normalizeServerId(serverId: string): string {
	if (serverId.startsWith("@")) {
		const firstSlashIndex = serverId.indexOf("/")
		if (firstSlashIndex !== -1) {
			return `${serverId.substring(0, firstSlashIndex)}-${serverId.substring(firstSlashIndex + 1)}`
		}
	}
	return serverId
}

/**
 * Converts a normalized server ID back to its original form
 * @param normalizedId - The normalized server ID
 * @returns Original server ID with slashes instead of dashes
 */
export function denormalizeServerId(normalizedId: string): string {
	if (normalizedId.startsWith("@")) {
		const dashIndex = normalizedId.indexOf("-")
		if (dashIndex !== -1) {
			return `${normalizedId.substring(0, dashIndex)}/${normalizedId.substring(dashIndex + 1)}`
		}
	}
	return normalizedId
}

/**
 * Extracts the server name from a server ID
 * @param serverId - The server ID to extract from
 * @returns The server name portion of the ID
 */
export function getServerName(serverId: string): string {
	if (serverId.startsWith("@") && serverId.includes("/")) {
		const slashIndex = serverId.indexOf("/");
		return serverId.substring(slashIndex + 1);
	}
	return serverId;
}
