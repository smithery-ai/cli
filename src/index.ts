#!/usr/bin/env node

import { createServer } from "node:http"
import chalk from "chalk"
import { Command } from "commander"
import { SKILL_AGENTS } from "./config/agents"
import { VALID_CLIENTS, type ValidClient } from "./config/clients"
import { DEFAULT_PORT } from "./constants"
import { errorMessage, fatal } from "./lib/cli-error"
import { setDebug, setVerbose } from "./lib/logger"
import type { ServerConfig } from "./types/registry"
import { validateClient } from "./utils/command-prompts"
import { getApiKey, setApiKey } from "./utils/smithery-settings"

// TypeScript declaration for global constant injected at build time
declare const __SMITHERY_VERSION__: string

const program = new Command()

// Configure the CLI
program
	.name("smithery")
	.version(__SMITHERY_VERSION__)
	.description(
		`${chalk.bold.italic.hex("#ea580c")("SMITHERY CLI")} ${chalk.bold.italic.hex("#ea580c")(`v${__SMITHERY_VERSION__}`)} — Discover and connect to 100K+ AI tools and skills`,
	)
	.option("--verbose", "Show detailed logs")
	.option("--debug", "Show debug logs")
	.addHelpText(
		"after",
		`
Learn how to use this CLI:
  smithery skills view smithery-ai/cli`,
	)
	.hook("preAction", (thisCommand, _actionCommand) => {
		const opts = thisCommand.opts()
		if (opts.verbose) {
			setVerbose(true)
		}
		if (opts.debug) {
			setDebug(true)
		}
	})

// ─── Shared action handlers ─────────────────────────────────────────────────
// Extracted to avoid duplication between canonical commands and hidden aliases.

async function handleSearch(term: string | undefined, options: any) {
	const apiKey = await getApiKey()

	if (options.interactive) {
		const { interactiveServerSearch } = await import("./utils/command-prompts")
		await interactiveServerSearch(apiKey, term)
		return
	}

	const { searchServers } = await import("./lib/registry")
	const { isJsonMode, outputTable, truncate } = await import("./utils/output")
	const searchTerm = term ?? ""
	const json = isJsonMode(options)

	if (json && !searchTerm) {
		fatal("Search term is required when using --json")
	}

	const results = await searchServers(searchTerm, apiKey, {
		verified: options.verified,
		pageSize: parseInt(options.limit, 10),
		page: parseInt(options.page, 10),
	})

	if (results.length === 0 && !json) {
		console.log(chalk.yellow("No servers found."))
		return
	}

	if (!term && !json) {
		console.log(chalk.bold("Most popular servers:\n"))
	}

	const data = results.map((server) => ({
		name: server.displayName || server.qualifiedName,
		qualifiedName: server.qualifiedName,
		description: server.description ?? "",
		useCount: server.useCount,
		connectionUrl: `https://server.smithery.ai/${server.qualifiedName}`,
	}))

	const page = parseInt(options.page, 10) || 1
	const limit = parseInt(options.limit, 10) || 10
	const hasMore = results.length >= limit

	outputTable({
		data,
		columns: [
			{ key: "qualifiedName", header: "SERVER" },
			{
				key: "description",
				header: "DESCRIPTION",
				format: (v) => truncate(String(v ?? "")),
			},
			{ key: "useCount", header: "USES", format: (v) => String(v ?? 0) },
		],
		json,
		jsonData: { servers: data, page, hasMore },
		pagination: { page, hasMore },
		tip: "Use smithery mcp add <connectionUrl> to connect a server.",
	})
}

async function handleRun(server: string, options: any) {
	const { parseServerConfig } = await import("./utils/command-prompts")
	const config: ServerConfig = options.config
		? parseServerConfig(options.config)
		: {}
	const { run } = await import("./commands/run/index")
	await run(server, config)
}

async function handleDev(entryFile: string | undefined, options: any) {
	const { dev } = await import("./commands/dev")
	await dev({
		entryFile,
		port: options.port,
		key: options.key,
		tunnel: options.tunnel,
		open: options.open,
		initialMessage: options.prompt,
		minify: options.minify,
	})
}

async function handleBuild(entryFile: string | undefined, options: any) {
	if (!["shttp", "stdio"].includes(options.transport)) {
		fatal(
			`Invalid transport type "${options.transport}". Valid options are: shttp, stdio`,
		)
	}

	if (options.out && /\.(js|cjs|mjs)$/.test(options.out)) {
		console.warn(
			chalk.yellow(`⚠ Warning: -o now expects a directory, not a file path.`),
		)
		console.warn(
			chalk.yellow(
				`  Change "${options.out}" to "${options.out.replace(/\/[^/]+\.(js|cjs|mjs)$/, "")}" instead.`,
			),
		)
		console.warn()
	}

	const { buildBundle } = await import("./lib/bundle")
	await buildBundle({
		entryFile,
		outDir: options.out,
		transport: options.transport as "shttp" | "stdio",
		production: true,
	})
}

async function handlePublish(server: string | undefined, options: any) {
	if (options.transport && !["shttp", "stdio"].includes(options.transport)) {
		fatal(
			`Invalid transport type "${options.transport}". Valid options are: shttp, stdio`,
		)
	}

	const isUrl = server?.startsWith("http://") || server?.startsWith("https://")

	const { deploy } = await import("./commands/deploy")
	await deploy({
		url: isUrl ? server : undefined,
		entryFile: isUrl ? undefined : server,
		key: options.key,
		name: options.name,
		resume: options.resume,
		transport: options.transport as "shttp" | "stdio",
		configSchema: options.configSchema,
	})
}

async function handleInstall(server: string | undefined, options: any) {
	const { selectClient, selectServer, parseServerConfig } = await import(
		"./utils/command-prompts"
	)
	const { installServer } = await import("./commands/install")

	const selectedClient = await selectClient(options.client, "Install")
	const selectedServer = await selectServer(server, selectedClient, undefined)
	validateClient(selectedClient)

	const config: ServerConfig = options.config
		? parseServerConfig(options.config)
		: {}

	await installServer(selectedServer, selectedClient as ValidClient, config)
}

async function handleUninstall(server: string | undefined, options: any) {
	const { readConfig } = await import("./lib/client-config-io")
	const { selectClient, selectInstalledServer } = await import(
		"./utils/command-prompts"
	)
	const { uninstallServer } = await import("./commands/uninstall")

	const selectedClient = await selectClient(options.client, "Uninstall")
	validateClient(selectedClient)

	const config = readConfig(selectedClient)
	const installedServers = Object.keys(config.mcpServers)
	const selectedServer = await selectInstalledServer(
		server,
		selectedClient,
		installedServers,
	)

	await uninstallServer(selectedServer, selectedClient as ValidClient)
}

const loadConnectCommands = () => import("./commands/connect")

async function handleAddConnection(server: string, options: any) {
	const { addServer } = await loadConnectCommands()
	await addServer(server, options)
}

async function handleListConnections(options: any) {
	const { listServers } = await loadConnectCommands()
	await listServers(options)
}

async function handleGetConnection(id: string, options: any) {
	const { getServer } = await loadConnectCommands()
	await getServer(id, options)
}

async function handleRemoveConnections(ids: string[], options: any) {
	const { removeServer } = await loadConnectCommands()
	await removeServer(ids, options)
}

async function handleSetConnection(
	id: string,
	mcpUrl: string | undefined,
	options: any,
) {
	const { setServer } = await loadConnectCommands()
	await setServer(id, mcpUrl, options)
}

async function handleFindTools(query: string | undefined, options: any) {
	const { findTools } = await loadConnectCommands()
	await findTools(query, options)
}

async function handleGetTool(
	connection: string,
	toolName: string,
	options: any,
) {
	const { getTool } = await loadConnectCommands()
	await getTool(connection, toolName, options)
}

async function handleCallTool(
	connection: string,
	toolName: string,
	args: string | undefined,
	options: any,
) {
	const { callTool } = await loadConnectCommands()
	await callTool(connection, toolName, args, options)
}

async function handleMcpAdd(server: string, options: any) {
	if (options.local) {
		await handleInstall(server, options)
		return
	}
	await handleAddConnection(server, options)
}

async function handleMcpRemove(ids: string[], options: any) {
	if (options.local) {
		await handleUninstall(ids[0], options)
		return
	}
	await handleRemoveConnections(ids, options)
}

async function handleLogin() {
	const { executeCliAuthFlow } = await import("./lib/cli-auth")
	const { validateApiKey } = await import("./lib/registry")

	console.log(chalk.cyan("Login to Smithery"))
	console.log()

	try {
		const apiKey = await executeCliAuthFlow()
		await validateApiKey(apiKey)
		const result = await setApiKey(apiKey)

		if (result.success) {
			console.log(chalk.green("✓ Successfully logged in"))
			console.log(chalk.gray("You can now use Smithery CLI commands"))
		} else {
			console.error(chalk.red("✗ Failed to save API key"))
			console.error(chalk.gray("You may need to log in again next time"))
		}
	} catch (error) {
		console.error(chalk.red("✗ Login failed"))
		console.error(chalk.gray(errorMessage(error)))
		process.exit(1)
	}
}

async function handleLogout() {
	const { clearApiKey, clearNamespace } = await import(
		"./utils/smithery-settings"
	)
	const { clearAllConfigs } = await import("./lib/keychain.js")

	console.log(chalk.cyan("Logging out of Smithery..."))
	await clearApiKey()
	await clearNamespace()
	await clearAllConfigs()
	console.log(chalk.green("✓ Successfully logged out"))
	console.log(chalk.gray("All local credentials have been removed"))
}

async function handleWhoami(options: any) {
	const { createSmitheryClientSync } = await import("./lib/smithery-client")

	async function mintApiKey() {
		const rootApiKey = await getApiKey()
		if (!rootApiKey) throw new Error("No API key found")
		const client = createSmitheryClientSync(rootApiKey)
		const token = await client.tokens.create({
			policy: [
				{
					resources: ["connections", "servers", "namespaces", "skills"],
					operations: ["read", "write", "execute"],
					namespaces: "*",
					metadata: { userId: "root-whoami" },
					ttl: 3600,
				},
			],
		})
		const apiKey = token.token
		const expiresAt = new Date(token.expiresAt)
		return { apiKey, expiresAt }
	}

	try {
		let { apiKey, expiresAt } = await mintApiKey()

		if (!apiKey) {
			console.log(chalk.yellow("No API key found"))
			console.log(chalk.gray("Run 'smithery auth login' to authenticate"))
			process.exit(1)
		}

		if (options.server) {
			const server = createServer(async (req, res) => {
				res.setHeader("Access-Control-Allow-Origin", "*")
				res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
				res.setHeader("Access-Control-Allow-Headers", "Content-Type")

				if (req.method === "OPTIONS") {
					res.writeHead(204)
					res.end()
					return
				}

				if (req.method === "GET" && req.url === "/whoami") {
					if (expiresAt <= new Date()) {
						const newToken = await mintApiKey()
						apiKey = newToken.apiKey
						expiresAt = newToken.expiresAt
					}
					res.writeHead(200, { "Content-Type": "application/json" })
					res.end(JSON.stringify({ SMITHERY_API_KEY: apiKey, expiresAt }))
				} else {
					res.writeHead(404, { "Content-Type": "application/json" })
					res.end(JSON.stringify({ error: "Not found" }))
				}
			})
			server.listen(4260, "localhost", () => {
				console.log(chalk.cyan("Server running at http://localhost:4260"))
				console.log(chalk.gray("GET /whoami to retrieve API key"))
				console.log(chalk.gray("Press Ctrl+C to stop"))
			})
			return
		}

		if (options.full) {
			console.log(`SMITHERY_API_KEY=${apiKey}`)
		} else {
			const masked = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
			console.log(chalk.cyan("API Key:"), masked)
			console.log(chalk.gray("Use --full to display the complete key"))
		}
	} catch (_error) {
		console.log(chalk.yellow("Not logged in"))
		console.log(chalk.gray("Run 'smithery auth login' to authenticate"))
		process.exit(1)
	}
}

// Helper to register search options on a command
function withSearchOptions(cmd: InstanceType<typeof Command>) {
	return cmd
		.option("--json", "Output results as JSON")
		.option("--table", "Output as human-readable table")
		.option("-i, --interactive", "Interactive search mode")
		.option("--verified", "Only show verified servers")
		.option("--limit <number>", "Max results per page", "10")
		.option("--page <number>", "Page number", "1")
}

// Helper to register dev options on a command
function withDevOptions(cmd: InstanceType<typeof Command>) {
	return cmd
		.option(
			"--port <port>",
			`Port to run the server on (default: ${DEFAULT_PORT})`,
		)
		.option("--key <apikey>", "Provide an API key")
		.option("--no-tunnel", "Don't start the tunnel")
		.option("--no-open", "Don't automatically open the playground")
		.option("--prompt <prompt>", "Initial message to start the playground with")
		.option(
			"--no-minify",
			"Build widgets without minification for easier debugging",
		)
}

// Helper to register build options on a command
function withBuildOptions(cmd: InstanceType<typeof Command>) {
	return cmd
		.option(
			"-o, --out <dir>",
			"Output directory (default: .smithery/shttp or .smithery/stdio)",
		)
		.option(
			"-t, --transport <type>",
			"Transport type: shttp or stdio (default: shttp)",
			"shttp",
		)
}

// Helper to register publish options on a command
function withPublishOptions(cmd: InstanceType<typeof Command>) {
	return cmd
		.option(
			"-n, --name <name>",
			"Target server qualified name (e.g., org/name)",
		)
		.option("-k, --key <apikey>", "Smithery API key")
		.option(
			"--resume",
			"Resume the latest paused publish (e.g., after OAuth authorization)",
		)
		.option(
			"-t, --transport <type>",
			"Transport type: shttp or stdio (default: shttp)",
			"shttp",
		)
		.option(
			"--config-schema <json-or-path>",
			"JSON Schema for server configuration. Inline JSON or path to .json file",
		)
}

/** Register a hidden backward-compat alias that copies options from a source command. */
function registerAlias(
	parent: InstanceType<typeof Command>,
	name: string,
	sourceCmd: InstanceType<typeof Command>,
	opts?: { deprecation?: string },
) {
	const alias = parent.command(name, { hidden: true })
	for (const opt of sourceCmd.options) {
		alias.addOption(opt)
	}
	if (opts?.deprecation) {
		alias.hook("preAction", () => {
			console.warn(chalk.yellow(opts.deprecation))
		})
	}
	// Copy action handler via internal property (Commander stores it as _actionHandler)
	const handler = (
		sourceCmd as unknown as { _actionHandler: (...args: unknown[]) => void }
	)._actionHandler
	if (handler) {
		alias.action(handler)
	}
	return alias
}

// ═══════════════════════════════════════════════════════════════════════════════
// MCP command — Search, connect, and manage MCP servers
// ═══════════════════════════════════════════════════════════════════════════════

const mcpCmd = program
	.command("mcp")
	.description("Search, connect, and manage MCP servers")

// ─── Publishing ─────────────────────────────────────────────────────────────

const publishCmd = withPublishOptions(
	mcpCmd
		.command("publish [server]")
		.description("Publish an MCP server to Smithery"),
)
	.action(handlePublish)
	.hook("postAction", (thisCommand) => {
		const server = thisCommand.args[0]
		const isUrl =
			server?.startsWith("http://") || server?.startsWith("https://")
		if (isUrl && !thisCommand.opts().configSchema) {
			console.log(
				chalk.dim(
					"\nTip: Use --config-schema to define configuration options for your server.",
				),
			)
		}
	})

// ─── Discovery ──────────────────────────────────────────────────────────────

mcpCmd.commandsGroup("Discovery:")

const searchCmd = withSearchOptions(
	mcpCmd.command("search [term]").description("Search the Smithery registry"),
)
	.addHelpText(
		"after",
		`
Examples:
  smithery mcp search slack
  smithery mcp search "web search" --json`,
	)
	.action(handleSearch)

// ─── Connections ────────────────────────────────────────────────────────────

mcpCmd.commandsGroup("Connections:")

mcpCmd
	.command("add <server>")
	.description("Add an MCP server connection")
	.option(
		"--id <id>",
		"Custom connection ID (defaults name to ID if name not set)",
	)
	.option("--name <name>", "Human-readable name for the server")
	.option("--metadata <json>", "Custom metadata as JSON object")
	.option("--headers <json>", "Custom headers as JSON object (stored securely)")
	.option("--namespace <ns>", "Target namespace")
	.option(
		"--force",
		"Create a new connection even if one already exists for this URL",
	)
	.option("--local", "Install to a local AI client instead of remote")
	.option(
		"-c, --client <name>",
		`AI client for local install (${VALID_CLIENTS.join(", ")})`,
	)
	.option(
		"--config <json>",
		"Configuration data as JSON for local install (skips prompts)",
	)
	.option("--json", "Output as JSON")
	.option("--table", "Output as human-readable table")
	.addHelpText(
		"after",
		`
Examples:
  smithery mcp add https://server.smithery.ai/exa
  smithery mcp add https://server.smithery.ai/exa --id exa --name "Exa Search"
  smithery mcp add anthropic/exa --local --client claude`,
	)
	.action(handleMcpAdd)

mcpCmd
	.command("list")
	.description("List your connections")
	.option("--namespace <ns>", "Namespace to list from")
	.option("--limit <n>", "Maximum number of results (default: all)")
	.option("--cursor <cursor>", "Pagination cursor from previous response")
	.option("--json", "Output as JSON")
	.option("--table", "Output as human-readable table")
	.addHelpText(
		"after",
		`
Examples:
  smithery mcp list
  smithery mcp list --json`,
	)
	.action(handleListConnections)

mcpCmd
	.command("get <id>")
	.description("Get connection details")
	.option("--namespace <ns>", "Namespace for the connection")
	.option("--json", "Output as JSON")
	.option("--table", "Output as human-readable table")
	.action(handleGetConnection)

const removeCmd = mcpCmd
	.command("remove <ids...>")
	.description("Remove connections")
	.option("--namespace <ns>", "Namespace for the server")
	.option("--local", "Uninstall from a local AI client instead of remote")
	.option(
		"-c, --client <name>",
		`AI client for local uninstall (${VALID_CLIENTS.join(", ")})`,
	)
	.option("--json", "Output as JSON")
	.option("--table", "Output as human-readable table")
	.action(handleMcpRemove)

registerAlias(mcpCmd, "rm <ids...>", removeCmd)

mcpCmd
	.command("set <id> [mcp-url]")
	.description("Create or update a connection by ID")
	.option("--name <name>", "Human-readable name")
	.option("--metadata <json>", "Metadata as JSON object")
	.option("--headers <json>", "Custom headers as JSON object (stored securely)")
	.option("--namespace <ns>", "Namespace for the server")
	.option("--json", "Output as JSON")
	.option("--table", "Output as human-readable table")
	.action(handleSetConnection)

// Hidden backward-compat aliases for deprecated install/uninstall
const mcpInstallCmd = mcpCmd
	.command("install [server]", { hidden: true })
	.option(
		"-c, --client <name>",
		`Specify the AI client (${VALID_CLIENTS.join(", ")})`,
	)
	.option(
		"--config <json>",
		"Provide configuration data as JSON (skips prompts)",
	)
	.hook("preAction", () => {
		console.warn(
			chalk.yellow(
				"Note: 'mcp install' is deprecated. Use 'smithery mcp add <server> --local' instead.",
			),
		)
	})
	.action(handleInstall)

const mcpUninstallCmd = mcpCmd
	.command("uninstall [server]", { hidden: true })
	.option(
		"-c, --client <name>",
		`Specify the AI client (${VALID_CLIENTS.join(", ")})`,
	)
	.hook("preAction", () => {
		console.warn(
			chalk.yellow(
				"Note: 'mcp uninstall' is deprecated. Use 'smithery mcp remove <server> --local' instead.",
			),
		)
	})
	.action(handleUninstall)

// ─── Development (hidden) ───────────────────────────────────────────────────

const devCmd = withDevOptions(
	mcpCmd
		.command("dev [entryFile]", { hidden: true })
		.description("Start development server with hot-reload"),
).action(handleDev)

const buildCmd = withBuildOptions(
	mcpCmd
		.command("build [entryFile]", { hidden: true })
		.description("Build MCP server for production"),
).action(handleBuild)

// Hidden within mcp: run (backward compat)
const runCmd = mcpCmd
	.command("run <server>", { hidden: true })
	.option("--config <json>", "Provide configuration as JSON")
	.action(handleRun)

// ═══════════════════════════════════════════════════════════════════════════════
// Tools command — Find and call tools from MCP servers added via 'smithery mcp'
// ═══════════════════════════════════════════════════════════════════════════════

const toolsCmd = program
	.command("tools")
	.description("Find and call tools from MCP servers added via 'smithery mcp'")

toolsCmd
	.command("find [query]")
	.description("Find tools across your connected MCP servers")
	.option("--connection <id>", "Limit search to a specific connection")
	.option("--namespace <ns>", "Namespace to search in")
	.option("--match <mode>", "Match mode: fuzzy, substring, or exact")
	.option("--limit <n>", "Maximum number of tools to return (default: 10)")
	.option("--page <n>", "Page number (default: 1)")
	.option("--all", "Return all matches without pagination")
	.option("--json", "Output as JSON")
	.option("--table", "Output as human-readable table")
	.addHelpText(
		"after",
		`
Examples:
  smithery tools find "create issue"                      Find by intent across connections
  smithery tools find --connection github --all           Show all tools for one connection
  smithery tools find notion-fetch --match exact --json   Exact match as JSON`,
	)
	.action(handleFindTools)

toolsCmd
	.command("get <connection> <tool>")
	.description("Get details for a specific tool")
	.option("--namespace <ns>", "Namespace for the tool")
	.option("--json", "Output as JSON")
	.option("--table", "Output as human-readable table")
	.addHelpText(
		"after",
		`
Examples:
  smithery tools get myserver search     Show tool details and input schema`,
	)
	.action(handleGetTool)

toolsCmd
	.command("call <connection> <tool> [args]")
	.description("Call a tool")
	.option("--namespace <ns>", "Namespace for the tool")
	.addHelpText(
		"after",
		`
Examples:
  smithery tools call myserver search '{"query":"hello"}'
  smithery tools call exa web_search_exa '{"query":"AI tools"}' | jq '.results'`,
	)
	.action(handleCallTool)

// ═══════════════════════════════════════════════════════════════════════════════
// Skills command — Search, view, and install Smithery skills
// ═══════════════════════════════════════════════════════════════════════════════

const skills = program
	.command("skills")
	.description("Search, view, and install Smithery skills")

skills
	.command("agents")
	.description("List available agents for skill installation")
	.action(() => {
		console.log(chalk.bold("Available agents:"))
		console.log()
		for (const agent of SKILL_AGENTS) {
			console.log(`  ${agent}`)
		}
		console.log()
		console.log(
			chalk.dim("See https://github.com/vercel-labs/skills for more info"),
		)
	})

skills
	.command("search <query>")
	.description("Search for skills in the Smithery registry")
	.option("--json", "Output results as JSON")
	.option("--table", "Output as human-readable table")
	.option("-i, --interactive", "Interactive search mode")
	.option("--limit <number>", "Maximum number of results to show", "10")
	.option("--page <number>", "Page number", "1")
	.option("--namespace <namespace>", "Filter by namespace")
	.action(async (query, options) => {
		const { searchSkills } = await import("./commands/skills")
		await searchSkills(query, {
			json: options.json,
			table: options.table,
			interactive: options.interactive,
			limit: Number.parseInt(options.limit, 10),
			page: Number.parseInt(options.page, 10),
			namespace: options.namespace,
		})
	})

skills
	.command("view <identifier>")
	.description("View a skill's documentation without installing")
	.action(async (identifier) => {
		const { viewSkill } = await import("./commands/skills")
		await viewSkill(identifier)
	})

skills
	.command("add <skill>")
	.description("Add a skill to your agent")
	.option(
		"-a, --agent <name>",
		`Target agent (${SKILL_AGENTS.slice(0, 5).join(", ")}, ...)`,
	)
	.option(
		"-g, --global",
		"Install globally (user-level) instead of project-level",
	)
	.action(async (skill, options) => {
		const { installSkill } = await import("./commands/skills")
		await installSkill(skill, options.agent, { global: options.global })
	})

// Skill voting (verbs instead of flags)
skills
	.command("upvote <skill>")
	.description("Upvote a skill")
	.action(async (skill) => {
		const { voteSkill } = await import("./commands/skills")
		await voteSkill(skill, "up")
	})

skills
	.command("downvote <skill>")
	.description("Downvote a skill")
	.action(async (skill) => {
		const { voteSkill } = await import("./commands/skills")
		await voteSkill(skill, "down")
	})

// skills review subcommand
const skillsReview = skills
	.command("review")
	.description("Manage skill reviews")

skillsReview
	.command("list <skill>")
	.description("List reviews for a skill")
	.option("--json", "Output as JSON")
	.option("--table", "Output as human-readable table")
	.option("--limit <number>", "Number of reviews to show", "10")
	.option("--page <number>", "Page number", "1")
	.action(async (skill, options) => {
		const { listReviews } = await import("./commands/skills")
		await listReviews(skill, {
			json: options.json,
			table: options.table,
			limit: Number.parseInt(options.limit, 10),
			page: Number.parseInt(options.page, 10),
		})
	})

skillsReview
	.command("add <skill>")
	.description("Add a review for a skill")
	.option("-b, --body <text>", "Review text (required)")
	.option("-m, --model <name>", "Agent model used (e.g., claude-3.5-sonnet)")
	.option("--up", "Upvote the skill")
	.option("--down", "Downvote the skill")
	.action(async (skill, options) => {
		if (!options.body) {
			console.error(chalk.red("Error: --body is required"))
			console.error(
				chalk.dim(
					'Usage: smithery skills review add <skill> --up|--down -b "review text"',
				),
			)
			process.exit(1)
		}
		if (!options.up && !options.down) {
			console.error(chalk.red("Error: --up or --down is required"))
			console.error(
				chalk.dim(
					'Usage: smithery skills review add <skill> --up|--down -b "review text"',
				),
			)
			process.exit(1)
		}
		if (options.up && options.down) {
			console.error(chalk.red("Error: Cannot specify both --up and --down"))
			process.exit(1)
		}
		const { submitReview } = await import("./commands/skills")
		await submitReview(skill, {
			review: options.body,
			model: options.model,
			vote: options.up ? "up" : "down",
		})
	})

const reviewRemoveCmd = skillsReview
	.command("remove <skill>")
	.description("Remove your review for a skill")
	.action(async (skill) => {
		const { deleteReview } = await import("./commands/skills")
		await deleteReview(skill)
	})

registerAlias(skillsReview, "rm <skill>", reviewRemoveCmd)

skillsReview
	.command("upvote <skill> <review-id>")
	.description("Upvote a review")
	.action(async (skill, reviewId) => {
		const { voteReview } = await import("./commands/skills")
		await voteReview(skill, reviewId, "up")
	})

skillsReview
	.command("downvote <skill> <review-id>")
	.description("Downvote a review")
	.action(async (skill, reviewId) => {
		const { voteReview } = await import("./commands/skills")
		await voteReview(skill, reviewId, "down")
	})

// ═══════════════════════════════════════════════════════════════════════════════
// Auth command — Authentication and permissions
// ═══════════════════════════════════════════════════════════════════════════════

program.commandsGroup("Authentication:")

const auth = program
	.command("auth")
	.description("Authentication and permissions")

auth.command("login").description("Login with Smithery").action(handleLogin)

auth
	.command("logout")
	.description("Log out and remove all local credentials")
	.action(handleLogout)

const whoamiCmd = auth
	.command("whoami")
	.description("Display the currently logged in user")
	.option("--full", "Show the full API key instead of masking it")
	.option(
		"--server",
		"Start an HTTP server on localhost:4260 that serves the API key",
	)
	.action(handleWhoami)

auth
	.command("token")
	.description("Mint a restricted service token")
	.option("--policy <json>", "Policy constraints as JSON array")
	.option("--json", "Output as JSON")
	.option("--table", "Output as human-readable table")
	.action(async (options) => {
		const { createToken } = await import("./commands/auth/token")
		await createToken(options)
	})

// ═══════════════════════════════════════════════════════════════════════════════
// Management
// ═══════════════════════════════════════════════════════════════════════════════

program.commandsGroup("Management:")

// Setup command - install the Smithery CLI skill
program
	.command("setup")
	.description("Install the Smithery CLI skill for your agent")
	.option(
		"-a, --agent <name>",
		`Target agent (${SKILL_AGENTS.slice(0, 5).join(", ")}, ...)`,
	)
	.option(
		"-g, --global",
		"Install globally (user-level) instead of project-level",
	)
	.action(async (options) => {
		const { installSkill } = await import("./commands/skills")
		await installSkill("smithery-ai/cli", options.agent, {
			global: options.global,
		})
	})

// Namespace command - manage namespace context
const namespace = program
	.command("namespace")
	.description("Manage namespace context")

namespace
	.command("list")
	.description("List available namespaces")
	.option("--json", "Output as JSON")
	.option("--table", "Output as human-readable table")
	.action(async (options) => {
		const { listNamespaces } = await import("./commands/namespace")
		await listNamespaces(options)
	})

namespace
	.command("use <name>")
	.description("Set current namespace")
	.action(async (name) => {
		const { useNamespace } = await import("./commands/namespace")
		await useNamespace(name)
	})

namespace
	.command("show")
	.description("Show current namespace")
	.action(async () => {
		const { showNamespace } = await import("./commands/namespace")
		await showNamespace()
	})

namespace
	.command("create <name>")
	.description("Create and claim a new namespace")
	.action(async (name) => {
		const { createNamespace } = await import("./commands/namespace")
		await createNamespace(name)
	})

// ═══════════════════════════════════════════════════════════════════════════════
// Hidden backward-compat aliases
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Top-level hidden aliases (backward compat) ────────────────────────────

registerAlias(program, "install [server]", mcpInstallCmd, {
	deprecation:
		"Note: 'install' is deprecated. Use 'smithery mcp add <server> --local' instead.",
})
registerAlias(program, "uninstall [server]", mcpUninstallCmd, {
	deprecation:
		"Note: 'uninstall' is deprecated. Use 'smithery mcp remove <server> --local' instead.",
})
registerAlias(program, "run <server>", runCmd)
registerAlias(program, "search [term]", searchCmd)
registerAlias(program, "dev [entryFile]", devCmd)
registerAlias(program, "build [entryFile]", buildCmd)
registerAlias(program, "publish [server]", publishCmd)
program.command("login", { hidden: true }).action(handleLogin)
program.command("logout", { hidden: true }).action(handleLogout)
registerAlias(program, "whoami", whoamiCmd)

const serversCompat = program
	.command("servers", { hidden: true })
	.description("Search and browse MCP servers")
registerAlias(serversCompat, "search [term]", searchCmd)

// ═══════════════════════════════════════════════════════════════════════════════
// Analytics: track command invocations
// ═══════════════════════════════════════════════════════════════════════════════

function getCommandPath(cmd: InstanceType<typeof Command>): string {
	const parts: string[] = []
	let current: InstanceType<typeof Command> | null = cmd
	while (current && current.name() !== "smithery") {
		parts.unshift(current.name())
		current = current.parent
	}
	return parts.join(".")
}

program.hook("preAction", async (_thisCommand, actionCommand) => {
	const { trackEvent } = await import("./utils/analytics")
	const commandPath = getCommandPath(actionCommand)
	const opts = actionCommand.opts()
	const flags = Object.keys(opts).filter((k) => opts[k] !== undefined)
	const isAgent = flags.includes("json") || !process.stdin.isTTY
	trackEvent("command_invocation", { command: commandPath, flags, isAgent })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Entry point
// ═══════════════════════════════════════════════════════════════════════════════

// Show help when no command is provided
if (process.argv.length <= 2) {
	program.help()
}

// Parse arguments and run
program.parseAsync(process.argv).catch((error: unknown) => {
	if (error instanceof Error) {
		console.error(chalk.red(`\n✗ ${error.message}`))
		if (process.argv.includes("--debug") && error.stack) {
			console.error(chalk.gray(error.stack))
		}
	} else {
		console.error(chalk.red(`\n✗ ${String(error)}`))
	}
	process.exit(1)
})
