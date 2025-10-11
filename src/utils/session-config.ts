import type {
	ConnectionInfo,
	ServerDetailResponse,
} from "@smithery/registry/models/components"
import chalk from "chalk"
import inquirer from "inquirer"
import {
	Transport,
	getClientConfiguration,
	getPreferredTransport,
} from "../config/clients"
import type {
	ConfiguredServer,
	JSONSchema,
	ServerConfig,
	StreamableHTTPConnection,
} from "../types/registry"

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
	connection: ConnectionInfo,
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
	connection: ConnectionInfo,
	existingValues?: ServerConfig,
): Promise<ServerConfig> {
	// Early exit if no config needed
	if (!connection.configSchema?.properties) {
		return {}
	}
	const baseConfig = existingValues || {}

	// Collect missing values
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
				{
					description,
					default: defaultValue,
					type,
				},
				new Set(connection.configSchema.required || []),
			)
			return { ...config, [key]: value !== undefined ? value : defaultValue }
		},
		Promise.resolve({} as ServerConfig),
	)

	// Final validation and formatting
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
 * @param profile - Optional profile name to use
 * @param client - Optional client name to determine transport type
 * @param server - Optional server details to check for HTTP support
 * @returns Configured server with command and arguments
 */
export function formatServerConfig(
	qualifiedName: string,
	userConfig: ServerConfig,
	apiKey: string | undefined,
	profile: string | undefined,
	client?: string,
	server?: ServerDetailResponse,
): ConfiguredServer {
	// Check if we should use HTTP format
	if (client && server && shouldUseHTTPFormat(client, server)) {
		return createHTTPServerConfig(
			qualifiedName,
			userConfig,
			apiKey,
			profile,
			client,
		)
	}

	// Default to STDIO format
	// Base arguments for npx command
	const npxArgs = ["-y", "@smithery/cli@latest", "run", qualifiedName]

	// Add API key if provided
	if (apiKey) {
		npxArgs.push("--key", apiKey)
	}

	// Add profile if provided
	if (profile) {
		npxArgs.push("--profile", profile)
	}

	const isEmptyConfig = Object.keys(userConfig).length === 0
	/* Add config flag if provided and not empty */
	if (!isEmptyConfig) {
		/* double stringify config to make it shell-safe */
		const encodedConfig = JSON.stringify(JSON.stringify(userConfig))
		npxArgs.push("--config", encodedConfig)
	}

	/* Use cmd /c for Windows platforms */
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

/**
 * Determines if HTTP format should be used based on client and server capabilities
 * @param client - The client name
 * @param server - The server details
 * @returns True if HTTP format should be used
 */
function shouldUseHTTPFormat(
	client: string,
	server: ServerDetailResponse,
): boolean {
	try {
		// Check if server has HTTP connections available
		const hasHTTPConnection = server.connections?.some(
			(conn: ConnectionInfo) => conn.type === "http" && "deploymentUrl" in conn,
		)

		if (!hasHTTPConnection || !server.remote) {
			return false // Server doesn't support HTTP or isn't remote
		}

		// Determine available transports based on server capabilities
		const availableTransports: Transport[] = []
		if (hasHTTPConnection) availableTransports.push(Transport.HTTP)
		if (
			server.connections?.some((conn: ConnectionInfo) => conn.type === "stdio")
		) {
			availableTransports.push(Transport.STDIO)
		}

		// Use the client's preferred transport
		const preferredTransport = getPreferredTransport(
			client,
			availableTransports,
		)
		return preferredTransport === Transport.HTTP
	} catch (_error) {
		// If we can't determine client capabilities, default to STDIO
		return false
	}
}

/**
 * Creates HTTP server configuration for clients that support it
 * @param qualifiedName - The fully qualified name of the server package
 * @param userConfig - The user configuration for the server
 * @param apiKey - Optional API key
 * @param profile - Optional profile name to use
 * @param client - Optional client name
 * @returns HTTP configuration
 */
function createHTTPServerConfig(
	qualifiedName: string,
	userConfig: ServerConfig,
	apiKey: string | undefined,
	profile: string | undefined,
	client?: string,
): StreamableHTTPConnection {
	// Build the HTTP URL for the server
	const baseUrl = `https://server.smithery.ai/${qualifiedName}/mcp`
	const url = new URL(baseUrl)

	// Check if client supports OAuth (don't add API key to URL)
	const clientConfig = client ? getClientConfiguration(client) : null
	const supportsOAuth = clientConfig?.supportsOAuth || false

	// Add query parameters
	if (apiKey && !supportsOAuth) {
		url.searchParams.set("api_key", apiKey)
	}

	if (profile) {
		url.searchParams.set("profile", profile)
	}

	// Add config as base64 encoded parameter if not empty
	if (Object.keys(userConfig).length > 0) {
		const configStr = JSON.stringify(userConfig)
		url.searchParams.set("config", Buffer.from(configStr).toString("base64"))
	}

	return {
		type: "http",
		url: url.toString(),
		headers: {},
	}
}
