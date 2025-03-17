import type { ConnectionDetails } from "../types/registry"
import type { ServerConfig } from "../types/registry"
import inquirer from "inquirer"
import chalk from "chalk"
import type { RegistryServer } from "../types/registry"

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

export async function collectConfigValues(
	connection: ConnectionDetails,
	existingValues?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const configValues: Record<string, unknown> = {}

	if (!connection.configSchema?.properties) {
		return existingValues || {}
	}

	const required = new Set(connection.configSchema.required || [])

	// Process existing values if provided
	if (existingValues) {
		return existingValues
	}

	// Collect values through prompts
	for (const [key, prop] of Object.entries(
		connection.configSchema.properties,
	)) {
		const schemaProp = prop as {
			description?: string
			default?: unknown
			type?: string
		}

		// If env var exists and setting is optional, ask if user wants to reuse it
		if (process.env[key] && !required.has(key)) {
			const { reuseExisting } = await inquirer.prompt<{
				reuseExisting: boolean
			}>([
				{
					type: "confirm",
					name: "reuseExisting",
					message: `Found ${key} in environment. Use it?`,
					default: true,
				},
			])

			if (reuseExisting) {
				configValues[key] = process.env[key]
				continue
			}
		}

		const requiredText = required.has(key)
			? chalk.red(" (required)")
			: chalk.gray(" (optional)")

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

	return configValues
}

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

export function envVarsToArgs(envVars: Record<string, string>): string[] {
	return Object.entries(envVars).flatMap(([key, value]) => {
		const argName = key.toLowerCase().replace(/_/g, "-")
		return [`--${argName}`, value]
	})
}

export function normalizeServerId(serverId: string): string {
	if (serverId.startsWith("@")) {
		const firstSlashIndex = serverId.indexOf("/")
		if (firstSlashIndex !== -1) {
			return `${serverId.substring(0, firstSlashIndex)}-${serverId.substring(firstSlashIndex + 1)}`
		}
	}
	return serverId
}

export function denormalizeServerId(normalizedId: string): string {
	if (normalizedId.startsWith("@")) {
		const dashIndex = normalizedId.indexOf("-")
		if (dashIndex !== -1) {
			return `${normalizedId.substring(0, dashIndex)}/${normalizedId.substring(dashIndex + 1)}`
		}
	}
	return normalizedId
}

export function getServerName(serverId: string): string {
	if (serverId.startsWith("@") && serverId.includes("/")) {
		const slashIndex = serverId.indexOf("/");
		return serverId.substring(slashIndex + 1);
	}
	return serverId;
}

