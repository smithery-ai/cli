import type { ConnectionDetails } from "./types/registry"
import type { ServerConfig } from "./types/registry"
import inquirer from "inquirer"
import chalk from "chalk"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import type { RegistryServer } from "./types/registry"
import {
	getAnalyticsConsent,
	setAnalyticsConsent,
	hasAskedConsent,
	initializeSettings,
} from "./smithery-config"

const execAsync = promisify(exec)

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

export function chooseConnection(server: RegistryServer): ConnectionDetails {
	if (!server.connections?.length) {
		throw new Error("No connection configuration found")
	}

	/* Prioritise WebSocket connection */
	const wsConnection = server.connections.find((conn) => conn.type === "ws")
	if (wsConnection) return wsConnection

	/* For stdio connections, prioritize published ones first */
	const stdioConnections = server.connections.filter(
		(conn) => conn.type === "stdio",
	)
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

	/* Fallback to first available connection if none match criteria */
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

async function isClientRunning(client?: string): Promise<boolean> {
	if (!client) return false

	try {
		const platform = process.platform
		const clientProcess =
			{
				claude: "Claude",
			}[client] || client

		if (platform === "win32") {
			const { stdout } = await execAsync(
				`tasklist /FI "IMAGENAME eq ${clientProcess}.exe" /NH`,
			)
			return stdout.includes(`${clientProcess}.exe`)
		} else if (platform === "darwin") {
			const { stdout } = await execAsync(`pgrep -x "${clientProcess}"`)
			return !!stdout.trim()
		} else if (platform === "linux") {
			const { stdout } = await execAsync(
				`pgrep -f "${clientProcess.toLowerCase()}"`,
			)
			return !!stdout.trim()
		}
		return false
	} catch (error) {
		return false
	}
}

async function restartClient(client: string): Promise<void> {
	const clientProcess =
		{
			claude: "Claude",
		}[client] || client

	try {
		const platform = process.platform
		if (platform === "win32") {
			await execAsync(
				`taskkill /F /IM "${clientProcess}.exe" && start "" "${clientProcess}.exe"`,
			)
		} else if (platform === "darwin") {
			await execAsync(
				`killall "${clientProcess}" && open -a "${clientProcess}"`,
			)
		} else if (platform === "linux") {
			await execAsync(
				`pkill -f "${clientProcess.toLowerCase()}" && ${clientProcess.toLowerCase()}`,
			)
		}

		await new Promise((resolve) => setTimeout(resolve, 2000))

		if (platform === "win32") {
			await execAsync(`start "" "${clientProcess}.exe"`)
		} else if (platform === "darwin") {
			await execAsync(`open -a "${clientProcess}"`)
		} else if (platform === "linux") {
			await execAsync(clientProcess.toLowerCase())
		}

		console.log(`${clientProcess} has been restarted.`)
	} catch (error) {
		console.error(`Failed to restart ${clientProcess}:`, error)
	}
}

export async function promptForRestart(client?: string): Promise<boolean> {
	if (!client) return false

	const isRunning = await isClientRunning(client)
	if (!isRunning) {
		return false
	}

	const { shouldRestart } = await inquirer.prompt<{ shouldRestart: boolean }>([
		{
			type: "confirm",
			name: "shouldRestart",
			message: `Would you like to restart the ${client} app to apply changes?`,
			default: true,
		},
	])

	if (shouldRestart) {
		console.log(`Restarting ${client} app...`)
		await restartClient(client)
	}

	return shouldRestart
}

export async function checkAnalyticsConsent(): Promise<void> {
	// Initialize settings and handle potential failures
	const initResult = await initializeSettings()
	if (!initResult.success) {
		console.warn("[Analytics] Failed to initialize settings:", initResult.error)
		return // Exit early if we can't initialize settings
	}

	const consent = await getAnalyticsConsent()
	// If consent is already true, no need to ask
	if (consent) return

	const askedConsent = await hasAskedConsent()

	/* Only ask if we haven't asked before and consent is false */
	if (!askedConsent) {
		try {
			const { EnableAnalytics } = await inquirer.prompt([
				{
					type: "confirm",
					name: "EnableAnalytics",
					message: `Would you like to help improve Smithery by sending anonymous usage data?\nFor information on Smithery's data policy, please visit: ${chalk.blue("https://smithery.ai/docs/data-policy")}`,
					default: true,
				},
			])

			const result = await setAnalyticsConsent(EnableAnalytics)
			if (!result.success) {
				console.warn("[Smithery] Failed to save preference:", result.error)
			}
		} catch (error) {
			// Handle potential inquirer errors
			console.warn(
				"[Smithery] Failed to prompt for consent:",
				error instanceof Error ? error.message : String(error),
			)
		}
	}
}
