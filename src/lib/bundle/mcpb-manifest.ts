import { execSync } from "node:child_process"
import type { McpbUserConfigurationOption } from "@anthropic-ai/mcpb"
import type { Prompt } from "@modelcontextprotocol/sdk/types.js"
import type { ScanResult } from "./scan.js"

const MCPB_MANIFEST_VERSION = "0.2"
const MCPB_ENTRY_POINT = "index.cjs"
const MCPB_SUPPORTED_PLATFORMS = ["darwin", "win32", "linux"] as const
const MCPB_SUPPORTED_NODE_RANGE = ">=18.0.0"

export { MCPB_ENTRY_POINT }

// Exported for testing
export { generateMCPConfigArgs, convertJsonSchemaToMCPBUserConfig }

interface JsonSchema {
	type?: string | string[]
	properties?: Record<string, JsonSchema>
	items?: JsonSchema
	default?: unknown
	enum?: unknown[]
	title?: string
	description?: string
	required?: string[]
	minimum?: number
	maximum?: number
}

function mapJsonSchemaTypeToMCPB(
	jsonSchemaType: string | string[] | undefined,
): "string" | "number" | "boolean" | "directory" | "file" {
	if (Array.isArray(jsonSchemaType)) {
		const type = jsonSchemaType.find((t) => t !== "null")
		return mapJsonSchemaTypeToMCPB(type)
	}
	switch (jsonSchemaType) {
		case "number":
		case "integer":
			return "number"
		case "boolean":
			return "boolean"
		default:
			return "string"
	}
}

function dotNotationToTitle(dotNotation: string): string {
	return dotNotation
		.split(".")
		.map((part) => {
			const spaced = part.replace(/([a-z])([A-Z])/g, "$1 $2")
			return spaced
				.split(" ")
				.map((word) => {
					const upperWord = word.toUpperCase()
					if (
						[
							"API",
							"URL",
							"HTTP",
							"HTTPS",
							"DB",
							"ID",
							"UUID",
							"JWT",
							"SSL",
							"TLS",
						].includes(upperWord)
					) {
						return upperWord
					}
					return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
				})
				.join(" ")
		})
		.join(" ")
}

function convertJsonSchemaToMCPBUserConfig(
	configSchema: JsonSchema | undefined,
): Record<string, McpbUserConfigurationOption> | undefined {
	if (
		!configSchema?.properties ||
		Object.keys(configSchema.properties).length === 0
	) {
		return undefined
	}

	const userConfig: Record<string, McpbUserConfigurationOption> = {}

	const flattenProperties = (
		properties: Record<string, JsonSchema>,
		requiredFields: string[] = [],
		prefix = "",
	): void => {
		for (const [key, prop] of Object.entries(properties)) {
			const fullKey = prefix ? `${prefix}.${key}` : key

			if (prop.type === "object" && prop.properties) {
				flattenProperties(prop.properties, prop.required || [], fullKey)
			} else {
				const configItem: McpbUserConfigurationOption = {
					type: mapJsonSchemaTypeToMCPB(prop.type),
					title: prop.title || dotNotationToTitle(fullKey),
					description:
						prop.description ||
						`Configuration for ${dotNotationToTitle(fullKey)}`,
				}

				if (requiredFields.includes(key)) {
					configItem.required = true
				}

				if (prop.default !== undefined && prop.default !== null) {
					const defaultValue = prop.default
					if (
						typeof defaultValue === "string" ||
						typeof defaultValue === "number" ||
						typeof defaultValue === "boolean" ||
						(Array.isArray(defaultValue) &&
							defaultValue.every((v) => typeof v === "string"))
					) {
						configItem.default = defaultValue as
							| string
							| number
							| boolean
							| string[]
					}
				}

				if (
					fullKey.toLowerCase().includes("key") ||
					fullKey.toLowerCase().includes("password") ||
					fullKey.toLowerCase().includes("secret") ||
					fullKey.toLowerCase().includes("token")
				) {
					configItem.sensitive = true
				}

				if (prop.type === "number" || prop.type === "integer") {
					if (prop.minimum !== undefined) configItem.min = prop.minimum
					if (prop.maximum !== undefined) configItem.max = prop.maximum
				}

				userConfig[fullKey] = configItem
			}
		}
	}

	flattenProperties(configSchema.properties, configSchema.required || [])
	return userConfig
}

function generateMCPConfigArgs(configSchema: JsonSchema | undefined): string[] {
	const baseArgs = [`\${__dirname}/${MCPB_ENTRY_POINT}`]

	if (
		!configSchema?.properties ||
		Object.keys(configSchema.properties).length === 0
	) {
		return baseArgs
	}

	const configArgs: string[] = []

	const flattenProperties = (
		properties: Record<string, JsonSchema>,
		prefix = "",
	): void => {
		for (const [key, prop] of Object.entries(properties)) {
			const fullKey = prefix ? `${prefix}.${key}` : key

			if (prop.type === "object" && prop.properties) {
				flattenProperties(prop.properties, fullKey)
			} else {
				configArgs.push(`${fullKey}=\${user_config.${fullKey}}`)
			}
		}
	}

	flattenProperties(configSchema.properties)
	return [...baseArgs, ...configArgs]
}

function getGitAuthor(): string {
	try {
		return execSync("git config user.name", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim()
	} catch {
		return "Smithery"
	}
}

function formatPromptForManifest(p: Prompt) {
	let argumentNames: string[] = []
	if (p.arguments) {
		if (Array.isArray(p.arguments)) {
			argumentNames = p.arguments.map((arg) =>
				typeof arg === "string"
					? arg
					: (arg as { name?: string }).name || "argument",
			)
		} else if (typeof p.arguments === "object") {
			argumentNames = Object.keys(p.arguments)
		}
	}
	return {
		name: p.name,
		description: p.description || "",
		...(argumentNames.length > 0 && { arguments: argumentNames }),
		text:
			argumentNames.length > 0
				? `${p.description || p.name}: ${argumentNames.map((arg) => `\${arguments.${arg}}`).join(", ")}`
				: p.description || p.name,
	}
}

export function createMcpbManifest(scanResult: ScanResult) {
	const serverInfo = scanResult.serverCard?.serverInfo
	const userConfig = convertJsonSchemaToMCPBUserConfig(
		scanResult.configSchema as JsonSchema | undefined,
	)

	return {
		manifest_version: MCPB_MANIFEST_VERSION,
		name: serverInfo?.name,
		version: serverInfo?.version,
		description: serverInfo?.description || "MCP Server",
		author: { name: getGitAuthor() },
		server: {
			type: "node",
			entry_point: MCPB_ENTRY_POINT,
			mcp_config: {
				command: "node",
				args: generateMCPConfigArgs(
					scanResult.configSchema as JsonSchema | undefined,
				),
				env: {},
			},
		},
		...(userConfig && { user_config: userConfig }),
		...(scanResult.serverCard?.tools?.length && {
			tools: scanResult.serverCard.tools.map((t) => ({
				name: t.name,
				description: t.description || "",
			})),
		}),
		...(scanResult.serverCard?.prompts?.length && {
			prompts: scanResult.serverCard.prompts.map(formatPromptForManifest),
		}),
		compatibility: {
			platforms: [...MCPB_SUPPORTED_PLATFORMS],
			runtimes: { node: MCPB_SUPPORTED_NODE_RANGE },
		},
	}
}
