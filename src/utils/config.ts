import type { ConnectionDetails } from "../types/registry"
import type { ConfiguredServer, ServerConfig } from "../types/registry"
import type { JSONSchema } from "../types/registry"
import inquirer from "inquirer"
import chalk from "chalk"
import type { RegistryServer } from "../types/registry"

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
	connection: ConnectionDetails,
	configValues?: ServerConfig,
): Promise<ServerConfig> {
	if (!connection.configSchema?.properties) {
		return configValues || {}
	}

	const required = new Set<string>(connection.configSchema.required || [])
	const formattedValues: ServerConfig = {}
	const missingRequired: string[] = []
	const validationErrors: Array<{ field: string; error: string }> = []

	for (const [key, prop] of Object.entries(
		connection.configSchema.properties,
	)) {
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

			// Skip optional fields with no value and no default
			if (finalValue === undefined) {
				continue
			}

			// Convert and include the value
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
 * Collects configuration values from saved config or user input
 * @param connection - Server connection details containing the config schema
 * @param existingValues - Optional existing values to use instead of prompting
 * @returns Object containing collected config values
 */
export async function collectConfigValues(
	connection: ConnectionDetails,
	existingValues?: ServerConfig,
): Promise<ServerConfig> {
	// 1. Early exit if no config needed
	if (!connection.configSchema?.properties) {
		return {}
	}

	let baseConfig: ServerConfig = {}

	// 2. Try to validate and use existing values
	if (existingValues) {
		try {
			return await validateAndFormatConfig(connection, existingValues)
		} catch {
			// If validation fails, use the existing values as base for collecting missing ones
			baseConfig = existingValues
		}
	}

	// 3. Collect missing values
	const required = new Set<string>(connection.configSchema.required || [])
	const properties = connection.configSchema.properties

	const collectedConfig = await Object.entries(properties).reduce(
		async (configPromise, [key, prop]) => {
			const config = await configPromise
			const {
				description,
				default: defaultValue,
				type,
			} = prop as {
				description?: string
				default?: unknown
				type?: string
			}

			// Skip if value already exists
			if (baseConfig[key] !== undefined) {
				return { ...config, [key]: baseConfig[key] }
			}

			// Prompt for missing value
			const value = await promptForConfigValue(
				key,
				{ description, default: defaultValue, type },
				required,
			)
			return { ...config, [key]: value !== undefined ? value : defaultValue }
		},
		Promise.resolve({} as ServerConfig),
	)

	// 4. Final validation and formatting
	try {
		return await validateAndFormatConfig(connection, collectedConfig)
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown configuration error"
		console.error(chalk.red("Configuration error:"), errorMessage)
		return collectedConfig
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
		description?: string
		default?: unknown
		type?: string
	},
	required: Set<string>,
): Promise<unknown> {
	const requiredText = required.has(key)
		? chalk.red(" (required)")
		: " (optional)"

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

	return value
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

	/* For remote servers, try HTTP */
	if (server.remote) {
		const httpConnection = server.connections.find(
			(conn) => conn.type === "http",
		)
		if (httpConnection) return httpConnection
	}

	/* If still no connection found, try stdio again */
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
		const slashIndex = serverId.indexOf("/")
		return serverId.substring(slashIndex + 1)
	}
	return serverId
}

/**
 * Formats server configuration into a standardized command structure
 * @param qualifiedName - The fully qualified name of the server package
 * @param userConfig - The user configuration for the server
 * @param apiKey - Optional API key
 * @param configNeeded - Whether the config flag is needed (defaults to true)
 * @returns Configured server with command and arguments
 */
export function formatServerConfig(
	qualifiedName: string,
	userConfig: ServerConfig,
	apiKey?: string,
	configNeeded = true, // whether config flag is needed
): ConfiguredServer {
	// Base arguments for npx command
	const npxArgs = ["-y", "@smithery/cli@latest", "run", qualifiedName]

	// Always add API key if provided
	if (apiKey) {
		npxArgs.push("--key", apiKey)
	}

	/**
	 * Add config flag in these scenarios:
	 * 1. api key is not given OR config is needed (configNeeded prop)
	 * 2. config is not empty
	 */
	const isEmptyConfig = Object.keys(userConfig).length === 0
	if (!isEmptyConfig && (!apiKey || configNeeded)) {
		/* double stringify config to make it shell-safe */
		const encodedConfig = JSON.stringify(JSON.stringify(userConfig))
		npxArgs.push("--config", encodedConfig)
	}

	// Use cmd /c for Windows platforms
	if (process.platform === "win32") {
		return {
			command: "cmd",
			args: ["/c", "npx", ...npxArgs],
		}
	}

	// Default for non-Windows platforms
	return {
		command: "npx",
		args: npxArgs,
	}
}
