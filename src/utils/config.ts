import type { ConnectionDetails } from "../types/registry"
import type { ServerConfig } from "../types/registry"
import inquirer from "inquirer"
import chalk from "chalk"
import type { RegistryServer } from "../types/registry"
import { fetchConfigWithApiKey } from "../registry.js"

/**
 * Formats configuration values according to the connection's schema
 * @param connection - Server connection details containing the config schema
 * @param configValues - Optional existing configuration values
 * @returns Formatted configuration values according to schema types
 * @throws Error if a required config value is missing
 */
export async function formatConfigValues(
	connection: ConnectionDetails /* Server config details */,
	configValues?: ServerConfig,
): Promise<ServerConfig> {
	const formattedValues: ServerConfig = {}

	if (!connection.configSchema?.properties) {
		return configValues || {}
	}

	const required = new Set(connection.configSchema.required || [])

	for (const [key, prop] of Object.entries(
		connection.configSchema.properties,
	)) {
		const schemaProp = prop as { type?: string; default?: unknown }
		const value = configValues?.[key]

		if (value !== undefined || schemaProp.default !== undefined) {
			formattedValues[key] = convertValueToType(
				value ?? schemaProp.default,
				schemaProp.type,
			)
		} else if (required.has(key)) {
			throw new Error(`Missing required config value: ${key}`)
		}
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
	if (!type || !value) return value

	switch (type) {
		case "boolean":
			return String(value).toLowerCase() === "true"
		case "number":
			return Number(value)
		case "integer":
			return Number.parseInt(String(value), 10)
		case "array":
			return Array.isArray(value)
				? value
				: String(value)
						.split(",")
						.map((item) => item.trim())
						.filter(Boolean)
		default:
			return value
	}
}

/**
 * Validates if saved configuration contains all required values
 * @param connection - Server connection details containing the config schema
 * @param savedConfig - Optional saved configuration to validate
 * @returns Object indicating if config is complete and the validated config
 */
export async function validateSavedConfig(
	connection: ConnectionDetails,
	savedConfig?: ServerConfig
): Promise<{ isValid: boolean; savedConfig?: Record<string, unknown> }> {
	// If no config schema or properties needed, return true with empty config
	if (!connection.configSchema?.properties) {
		return { isValid: true, savedConfig: {} }
	}

	// If config is needed but none provided, return false
	if (!savedConfig) {
		return { isValid: false }
	}

	try {
		const required = new Set(connection.configSchema.required || [])
		
		const hasAllRequired = Array.from(required as Set<string>).every(
			key => typeof savedConfig === 'object' && savedConfig !== null && key in savedConfig
		)

		if (hasAllRequired) {
			// Only log if we actually have some config to use
			// if (Object.keys(savedConfig).length > 0) {
			// 	console.log(chalk.green("✓ Using saved configuration"))
			// }
			return { isValid: true, savedConfig }
		}

		return { isValid: false, savedConfig }
	} catch (error) {
		return { isValid: false }
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
	existingValues?: Record<string, unknown>,
	apiKey?: string,
	serverName?: string,
): Promise<{ configValues: ServerConfig; isSavedConfigValid: boolean }> {
	if (existingValues) { // if existing values given, pass through
		return { configValues: existingValues, isSavedConfigValid: false };
	}

	if (!connection.configSchema?.properties) {
		return { configValues: {}, isSavedConfigValid: false };
	}

	// Fetch config first if API key is provided
	let fetchedConfig: ServerConfig = {}
	if (apiKey && serverName) {
		try {
			fetchedConfig = await fetchConfigWithApiKey(serverName, apiKey)
			// Only log if we actually have some config to use
			// if (Object.keys(fetchedConfig).length > 0) {
			// 	console.log(chalk.green("✓ Loaded saved configuration"))
			// }
		} catch (error) {
			// Only warn if the server actually needs configuration
			if (connection.configSchema?.required?.length || 
				Object.keys(connection.configSchema?.properties || {}).length > 0) {
				console.warn(chalk.yellow("Could not load saved configuration, will prompt for values"))
			}
		}
	}

	// Then validate it
	const { isValid, savedConfig: validatedConfig } = await validateSavedConfig(
		connection,
		fetchedConfig
	)

	// If saved config is valid, return it with flag
	if (isValid && validatedConfig) {
		return { configValues: validatedConfig, isSavedConfigValid: true };
	}

	// Otherwise, collect missing values
	const configValues: ServerConfig = { ...(validatedConfig || {}) }

	const required = new Set(connection.configSchema.required || [])
	const properties = connection.configSchema.properties

	// Check which values we still need to collect
	for (const [key, prop] of Object.entries(properties)) {
		const schemaProp = prop as {
			description?: string
			default?: unknown
			type?: string
		}

		// If we already have this value from saved config, use it
		if (fetchedConfig[key] !== undefined) {
			configValues[key] = fetchedConfig[key]
			continue
		}

		// Prompt for any values not already set (both required and optional)
		if (configValues[key] === undefined) {
			const requiredText = required.has(key) ? chalk.red(" (required)") : " (optional)"
			
			const promptType = key.toLowerCase().includes("key")
				? "password"
				: schemaProp.type === "boolean"
					? "confirm"
					: schemaProp.type === "array"
						? "input"
						: schemaProp.type === "number" || schemaProp.type === "integer"
							? "number"
							: "input"

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
						if (required.has(key) && !input) return false
						if (schemaProp.type === "number" || schemaProp.type === "integer") {
							return !Number.isNaN(Number(input)) || "Please enter a valid number"
						}
						return true
					},
				},
			])

			if (value !== undefined || schemaProp.default !== undefined) {
				configValues[key] = value ?? schemaProp.default
			}
		}
	}

	// Return collected values but flag that they're not completely from saved config
	return { configValues: { ...fetchedConfig, ...configValues }, isSavedConfigValid: false };
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

