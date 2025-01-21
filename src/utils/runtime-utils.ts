import { exec } from "node:child_process"
import { promisify } from "node:util"
import inquirer from "inquirer"
import chalk from "chalk"
import type { ConnectionDetails } from "../types/registry.js"

interface PromptInfo {
	key: string
	description: string
	required: boolean
	default?: unknown
}

const execAsync = promisify(exec)

export async function checkUVInstalled(): Promise<boolean> {
	try {
		await execAsync("uvx --version")
		return true
	} catch (error) {
		return false
	}
}

export async function promptForUVInstall(
	inquirerInstance: typeof inquirer,
): Promise<boolean> {
	const { shouldInstall } = await inquirerInstance.prompt<{
		shouldInstall: boolean
	}>([
		{
			type: "confirm",
			name: "shouldInstall",
			message:
				"UV package manager is required for Python MCP servers. Would you like to install it?",
			default: true,
		},
	])

	if (!shouldInstall) {
		console.warn(
			chalk.yellow(
				"UV installation was declined. You can install it manually from https://astral.sh/uv",
			),
		)
		return false
	}

	console.log("Installing uv package manager...")
	try {
		await execAsync("curl -LsSf https://astral.sh/uv/install.sh | sh")
		console.log(chalk.green("✓ UV installed successfully"))
		return true
	} catch (error) {
		console.warn(
			chalk.yellow(
				"Failed to install UV. You can install it manually from https://astral.sh/uv",
			),
		)
		return false
	}
}

export async function collectConfigValues(
	connection: ConnectionDetails,
	existingValues?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const promptsMap = new Map<string, PromptInfo & { type?: string }>()

	// Process config schema if it exists
	if (connection.configSchema?.properties) {
		const required = new Set(connection.configSchema.required || [])

		Object.entries(connection.configSchema.properties).forEach(
			([key, prop]) => {
				const schemaProp = prop as {
					description?: string
					default?: unknown
					type?: string
				}
				promptsMap.set(key, {
					key,
					description: schemaProp.description || `Enter value for ${key}`,
					required: required.has(key),
					default: schemaProp.default,
					type: schemaProp.type,
				})
			},
		)
	}

	const configValues: Record<string, unknown> = {}

	function convertValueToType(
		value: unknown,
		type: string | undefined,
	): unknown {
		if (!type) return value

		// Handle empty string inputs
		if (value === "") {
			switch (type) {
				case "array":
					return []
				case "number":
				case "integer":
					return null
				default:
					return value
			}
		}

		if (!value) return value

		switch (type) {
			case "boolean":
				return String(value).toLowerCase() === "true"
			case "number":
				return Number(value)
			case "integer":
				return Number.parseInt(String(value), 10)
			case "array":
				// Parse comma-separated string into array
				return String(value)
					.split(",")
					.map((item) => item.trim())
					.filter((item) => item !== "") // Remove empty items
			default:
				return value
		}
	}

	// If we have existing values, process them according to schema
	if (existingValues) {
		for (const prompt of promptsMap.values()) {
			const value = existingValues[prompt.key]
			if (value !== undefined || prompt.default !== undefined) {
				configValues[prompt.key] = convertValueToType(
					value ?? prompt.default,
					prompt.type,
				)
			} else if (prompt.required) {
				throw new Error(`Missing required config value: ${prompt.key}`)
			}
		}
		return configValues
	}

	// Original prompting logic for installation
	for (const prompt of promptsMap.values()) {
		// If env var exists and setting is optional, ask if user wants to reuse it
		if (process.env[prompt.key] && !prompt.required) {
			const { reuseExisting } = await inquirer.prompt<{
				reuseExisting: boolean
			}>([
				{
					type: "confirm",
					name: "reuseExisting",
					message: `Found ${prompt.key} in environment. Use it?`,
					default: true,
				},
			])

			if (reuseExisting) {
				configValues[prompt.key] = convertValueToType(
					process.env[prompt.key],
					prompt.type,
				)
				continue
			}
		}

		const requiredText = prompt.required
			? chalk.red(" (required)")
			: chalk.gray(" (optional)")

		const promptType = prompt.key.toLowerCase().includes("key")
			? "password" // Use password type for any field containing 'key'
			: prompt.type === "boolean"
				? "confirm"
				: prompt.type === "array"
					? "input"
					: prompt.type === "number" || prompt.type === "integer"
						? "number"
						: "input"

		const { value } = await inquirer.prompt([
			{
				type: promptType,
				name: "value",
				message: `${prompt.description}${requiredText}${
					prompt.type === "array" ? " (comma-separated)" : ""
				}`,
				default: prompt.default,
				mask: promptType === "password" ? "*" : undefined, // Add masking for password fields
				validate: (input: string | number) => {
					if (prompt.required && !input) return false
					if (prompt.type === "number" || prompt.type === "integer") {
						return !Number.isNaN(Number(input)) || "Please enter a valid number"
					}
					return true
				},
			},
		])

		if (value !== undefined || prompt.default !== undefined) {
			configValues[prompt.key] = convertValueToType(
				value ?? prompt.default,
				prompt.type,
			)
		}
	}

	return configValues
}
