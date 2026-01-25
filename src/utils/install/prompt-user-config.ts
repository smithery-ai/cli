import type { ServerGetResponse } from "@smithery/api/resources/servers/servers"

type Connection =
	| ServerGetResponse.StdioConnection
	| ServerGetResponse.HTTPConnection

import chalk from "chalk"
import inquirer from "inquirer"
import type { JSONSchema, ServerConfig } from "../../types/registry"
import { validateAndFormatConfig } from "./user-config.js"

/**
 * Collects configuration values from saved config or user input
 * @param connection - Server connection details containing the config schema
 * @param existingValues - Optional existing values to use instead of prompting
 * @returns Object containing collected config values
 */
export async function collectConfigValues(
	connection: Connection,
	existingValues?: ServerConfig,
): Promise<ServerConfig> {
	// Early exit if no config needed
	const configSchema = connection.configSchema as JSONSchema | undefined
	if (!configSchema?.properties) {
		return {}
	}
	const baseConfig = existingValues || {}

	// Collect missing values
	const properties = configSchema.properties
	const required = new Set<string>(configSchema.required || [])

	const collectedConfig: ServerConfig = {}

	// STEP 1: Prompt for all required fields first
	for (const [key, prop] of Object.entries(properties)) {
		const {
			description,
			default: defaultValue,
			type,
		} = prop as {
			description?: string
			default?: unknown
			type?: string
		}

		// Use existing value if available
		if (baseConfig[key] !== undefined) {
			collectedConfig[key] = baseConfig[key]
			continue
		}

		// Only prompt for required fields in this step
		if (required.has(key)) {
			const value = await promptForConfigValue(
				key,
				{
					description,
					default: defaultValue,
					type,
				},
				required,
			)
			collectedConfig[key] = value !== undefined ? value : defaultValue
		}
	}

	// STEP 2: Check if there are any optional fields that need prompting
	const hasOptionalFields = Object.keys(properties).some(
		(key) => !required.has(key) && baseConfig[key] === undefined,
	)

	// STEP 3: Ask if user wants to configure optional fields (after required)
	let configureOptional = false
	if (hasOptionalFields) {
		const { configure } = await inquirer.prompt([
			{
				type: "confirm",
				name: "configure",
				message: "Would you like to add optional configuration?",
				default: false,
			},
		])
		configureOptional = configure
	}

	// STEP 4: Prompt for optional fields if requested
	if (configureOptional) {
		for (const [key, prop] of Object.entries(properties)) {
			const {
				description,
				default: defaultValue,
				type,
			} = prop as {
				description?: string
				default?: unknown
				type?: string
			}

			// Skip if already collected or is required
			if (collectedConfig[key] !== undefined || required.has(key)) {
				continue
			}

			const value = await promptForConfigValue(
				key,
				{
					description,
					default: defaultValue,
					type,
				},
				required,
			)
			if (value !== undefined || defaultValue !== undefined) {
				collectedConfig[key] = value !== undefined ? value : defaultValue
			}
		}
	}

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
		: " (press enter to skip)"

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
