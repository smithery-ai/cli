import { describe, expect, test } from "vitest"
import {
	convertJsonSchemaToMCPBUserConfig,
	createMcpbManifest,
	generateMCPConfigArgs,
	MCPB_ENTRY_POINT,
} from "../../bundle/mcpb-manifest.js"
import type { ScanResult } from "../../bundle/scan.js"

describe("generateMCPConfigArgs", () => {
	test("returns base args without config", () => {
		const result = generateMCPConfigArgs(undefined)
		expect(result).toEqual([`\${__dirname}/${MCPB_ENTRY_POINT}`])
	})

	test("returns base args with empty config", () => {
		const result = generateMCPConfigArgs({ type: "object", properties: {} })
		expect(result).toEqual([`\${__dirname}/${MCPB_ENTRY_POINT}`])
	})

	test("includes config args for flat schema", () => {
		const result = generateMCPConfigArgs({
			type: "object",
			properties: {
				apiKey: { type: "string" },
				maxRetries: { type: "number" },
			},
		})
		expect(result).toEqual([
			`\${__dirname}/${MCPB_ENTRY_POINT}`,
			// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal string output
			"apiKey=${user_config.apiKey}",
			// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal string output
			"maxRetries=${user_config.maxRetries}",
		])
	})

	test("handles nested config schema", () => {
		const result = generateMCPConfigArgs({
			type: "object",
			properties: {
				auth: {
					type: "object",
					properties: {
						apiKey: { type: "string" },
						token: { type: "string" },
					},
				},
			},
		})
		expect(result).toContain(`\${__dirname}/${MCPB_ENTRY_POINT}`)
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal string output
		expect(result).toContain("auth.apiKey=${user_config.auth.apiKey}")
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal string output
		expect(result).toContain("auth.token=${user_config.auth.token}")
	})
})

describe("convertJsonSchemaToMCPBUserConfig", () => {
	test("returns undefined for empty schema", () => {
		expect(convertJsonSchemaToMCPBUserConfig(undefined)).toBeUndefined()
		expect(
			convertJsonSchemaToMCPBUserConfig({ type: "object", properties: {} }),
		).toBeUndefined()
	})

	test("converts flat schema", () => {
		const result = convertJsonSchemaToMCPBUserConfig({
			type: "object",
			properties: {
				name: { type: "string", description: "User name" },
				count: { type: "number" },
			},
			required: ["name"],
		})

		expect(result).toEqual({
			name: {
				type: "string",
				title: "Name",
				description: "User name",
				required: true,
			},
			count: {
				type: "number",
				title: "Count",
				description: "Configuration for Count",
			},
		})
	})

	test("marks sensitive fields", () => {
		const result = convertJsonSchemaToMCPBUserConfig({
			type: "object",
			properties: {
				apiKey: { type: "string" },
				password: { type: "string" },
				secretToken: { type: "string" },
			},
		})

		expect(result?.apiKey?.sensitive).toBe(true)
		expect(result?.password?.sensitive).toBe(true)
		expect(result?.secretToken?.sensitive).toBe(true)
	})

	test("includes default values", () => {
		const result = convertJsonSchemaToMCPBUserConfig({
			type: "object",
			properties: {
				timeout: { type: "number", default: 30 },
				debug: { type: "boolean", default: false },
			},
		})

		expect(result?.timeout?.default).toBe(30)
		expect(result?.debug?.default).toBe(false)
	})

	test("includes min/max for numbers", () => {
		const result = convertJsonSchemaToMCPBUserConfig({
			type: "object",
			properties: {
				port: { type: "number", minimum: 1, maximum: 65535 },
			},
		})

		expect(result?.port?.min).toBe(1)
		expect(result?.port?.max).toBe(65535)
	})

	test("flattens nested objects with dot notation", () => {
		const result = convertJsonSchemaToMCPBUserConfig({
			type: "object",
			properties: {
				database: {
					type: "object",
					properties: {
						host: { type: "string" },
						port: { type: "number" },
					},
					required: ["host"],
				},
			},
		})

		expect(result?.["database.host"]).toEqual({
			type: "string",
			title: "Database Host",
			description: "Configuration for Database Host",
			required: true,
		})
		expect(result?.["database.port"]).toBeDefined()
	})
})

describe("createMcpbManifest", () => {
	test("creates manifest with minimal scan result", () => {
		const scanResult: ScanResult = {
			serverCard: {
				serverInfo: { name: "test-server", version: "1.0.0" },
				tools: [],
				resources: [],
				prompts: [],
			},
		}

		const manifest = createMcpbManifest(scanResult)

		expect(manifest.manifest_version).toBe("0.2")
		expect(manifest.name).toBe("test-server")
		expect(manifest.version).toBe("1.0.0")
		expect(manifest.description).toBe("MCP Server")
		expect(manifest.author).toHaveProperty("name")
		expect(typeof manifest.author.name).toBe("string")
		expect(manifest.server.type).toBe("node")
		expect(manifest.server.entry_point).toBe("index.cjs")
		expect(manifest.server.mcp_config.command).toBe("node")
	})

	test("uses server description when available", () => {
		const scanResult: ScanResult = {
			serverCard: {
				serverInfo: {
					name: "my-server",
					version: "2.0.0",
					description: "A custom MCP server",
				},
				tools: [],
				resources: [],
				prompts: [],
			},
		}

		const manifest = createMcpbManifest(scanResult)
		expect(manifest.description).toBe("A custom MCP server")
	})

	test("includes tools in manifest", () => {
		const scanResult: ScanResult = {
			serverCard: {
				serverInfo: { name: "test", version: "1.0.0" },
				tools: [
					{
						name: "search",
						description: "Search for items",
						inputSchema: { type: "object" },
					},
					{ name: "create", description: "", inputSchema: { type: "object" } },
				],
				resources: [],
				prompts: [],
			},
		}

		const manifest = createMcpbManifest(scanResult)

		expect(manifest.tools).toEqual([
			{ name: "search", description: "Search for items" },
			{ name: "create", description: "" },
		])
	})

	test("includes prompts with arguments", () => {
		const scanResult: ScanResult = {
			serverCard: {
				serverInfo: { name: "test", version: "1.0.0" },
				tools: [],
				resources: [],
				prompts: [
					{
						name: "greeting",
						description: "Generate a greeting",
						arguments: [{ name: "name", required: true }],
					},
				],
			},
		}

		const manifest = createMcpbManifest(scanResult)

		expect(manifest.prompts).toEqual([
			{
				name: "greeting",
				description: "Generate a greeting",
				arguments: ["name"],
				// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal string output
				text: "Generate a greeting: ${arguments.name}",
			},
		])
	})

	test("includes user_config when configSchema present", () => {
		const scanResult: ScanResult = {
			serverCard: {
				serverInfo: { name: "test", version: "1.0.0" },
				tools: [],
				resources: [],
				prompts: [],
			},
			configSchema: {
				type: "object",
				properties: {
					apiKey: { type: "string" },
				},
				required: ["apiKey"],
			},
		}

		const manifest = createMcpbManifest(scanResult)

		expect(manifest.user_config).toBeDefined()
		expect(manifest.user_config?.apiKey).toEqual({
			type: "string",
			title: "API Key",
			description: "Configuration for API Key",
			required: true,
			sensitive: true,
		})
		expect(manifest.server.mcp_config.args).toContain(
			// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal string output
			"apiKey=${user_config.apiKey}",
		)
	})
})
