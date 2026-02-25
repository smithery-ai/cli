#!/usr/bin/env node

import { createServer } from "node:http"
import pc from "picocolors"

const brandOrange = (text: string) => `\x1b[38;2;234;88;12m${text}\x1b[39m`

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
		`${pc.bold(pc.italic(brandOrange("SMITHERY CLI")))} ${pc.bold(pc.italic(brandOrange(`v${__SMITHERY_VERSION__}`)))} — Discover and connect to 100K+ AI tools and skills`,
	)
	.option("--verbose", "Show detailed logs")
	.option("--debug", "Show debug logs")
	.option("--json", "Output as JSON")
	.option("--table", "Output as human-readable table")
	.addHelpText(
		"after",
		`
Learn how to use this CLI:
  smithery skill view smithery-ai/cli`,
	)
	.hook("preAction", async (thisCommand, _actionCommand) => {
		const opts = thisCommand.opts()
		if (opts.verbose) {
			setVerbose(true)
		}
		if (opts.debug) {
			setDebug(true)
		}
		const { setOutputMode } = await import("./utils/output")
		setOutputMode({ json: opts.json, table: opts.table })
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
	const json = isJsonMode()

	if (json && !searchTerm) {
		fatal("Search term is required when using --json")
	}

	const results = await searchServers(searchTerm, apiKey, {
		verified: options.verified,
		pageSize: parseInt(options.limit, 10),
		page: parseInt(options.page, 10),
	})

	if (results.length === 0 && !json) {
		console.log(pc.yellow("No servers found."))
		return
	}

	if (!term && !json) {
		console.log(pc.bold("Most popular servers:\n"))
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
	const { dev } = await import("./commands/mcp/dev")
	await dev({
		entryFile,
		port: options.port,
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
			pc.yellow(`⚠ Warning: -o now expects a directory, not a file path.`),
		)
		console.warn(
			pc.yellow(
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
	const isUrl = server?.startsWith("http://") || server?.startsWith("https://")

	const { deploy } = await import("./commands/mcp/deploy")
	await deploy({
		url: isUrl ? server : undefined,
		entryFile: isUrl ? undefined : server,
		name: options.name,
		resume: options.resume,
		configSchema: options.configSchema,
		fromBuild: options.fromBuild,
	})
}

async function handleInstall(server: string | undefined, options: any) {
	const { selectClient, selectServer, parseServerConfig } = await import(
		"./utils/command-prompts"
	)
	const { installServer } = await import("./commands/mcp/install")

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
	const { uninstallServer } = await import("./commands/mcp/uninstall")

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

const loadConnectCommands = () => import("./commands/mcp")

async function handleAddConnection(server: string, options: any) {
	const { addServer } = await loadConnectCommands()
	await addServer(server, options)
}

async function handleListConnections(options: any) {
	if (options.client) {
		const { listClientServers } = await import("./commands/mcp/list")
		await listClientServers(options.client)
		return
	}
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

async function handleUpdateConnection(id: string, options: any) {
	const { updateServer } = await loadConnectCommands()
	await updateServer(id, options)
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
	if (options.client) {
		await handleInstall(server, options)
		return
	}
	await handleAddConnection(server, options)
}

async function handleMcpRemove(ids: string[], options: any) {
	if (options.client) {
		await handleUninstall(ids[0], options)
		return
	}
	await handleRemoveConnections(ids, options)
}

async function handleLogs(server: string, options: any) {
	const { listLogs } = await import("./commands/mcp/logs")
	await listLogs(server, options)
}

async function handleSecretsList(server: string) {
	const { listSecrets } = await import("./commands/mcp/secrets")
	await listSecrets(server)
}

async function handleSecretsSet(
	server: string,
	name: string | undefined,
	value: string | undefined,
) {
	const { setSecret } = await import("./commands/mcp/secrets")
	await setSecret(server, { name, value })
}

async function handleSecretsDelete(server: string, name: string) {
	const { deleteSecret } = await import("./commands/mcp/secrets")
	await deleteSecret(server, name)
}

async function handleLogin() {
	const { executeCliAuthFlow } = await import("./lib/cli-auth")
	const { validateApiKey } = await import("./lib/registry")

	console.log(pc.cyan("Login to Smithery"))
	console.log()

	try {
		const apiKey = await executeCliAuthFlow()
		await validateApiKey(apiKey)
		const result = await setApiKey(apiKey)

		if (result.success) {
			console.log(pc.green("✓ Successfully logged in"))
			console.log(pc.gray("You can now use Smithery CLI commands"))
		} else {
			console.error(pc.red("✗ Failed to save API key"))
			console.error(pc.gray("You may need to log in again next time"))
		}
	} catch (error) {
		console.error(pc.red("✗ Login failed"))
		console.error(pc.gray(errorMessage(error)))
		process.exit(1)
	}
}

async function handleLogout() {
	const { clearApiKey, clearNamespace } = await import(
		"./utils/smithery-settings"
	)
	const { clearAllConfigs } = await import("./lib/keychain.js")

	console.log(pc.cyan("Logging out of Smithery..."))
	await clearApiKey()
	await clearNamespace()
	await clearAllConfigs()
	console.log(pc.green("✓ Successfully logged out"))
	console.log(pc.gray("All local credentials have been removed"))
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
			console.log(pc.yellow("No API key found"))
			console.log(pc.gray("Run 'smithery auth login' to authenticate"))
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
				console.log(pc.cyan("Server running at http://localhost:4260"))
				console.log(pc.gray("GET /whoami to retrieve API key"))
				console.log(pc.gray("Press Ctrl+C to stop"))
			})
			return
		}

		if (options.full) {
			console.log(`SMITHERY_API_KEY=${apiKey}`)
		} else {
			const masked = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
			console.log(pc.cyan("API Key:"), masked)
			console.log(pc.gray("Use --full to display the complete key"))
		}
	} catch (_error) {
		console.log(pc.yellow("Not logged in"))
		console.log(pc.gray("Run 'smithery auth login' to authenticate"))
		process.exit(1)
	}
}

// Helper to register search options on a command
function withSearchOptions(cmd: InstanceType<typeof Command>) {
	return cmd
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
		.option(
			"--resume",
			"Resume the latest paused publish (e.g., after OAuth authorization)",
		)
		.option(
			"--config-schema <json-or-path>",
			"JSON Schema for server configuration. Inline JSON or path to .json file",
		)
		.option(
			"--from-build <dir>",
			"Publish from pre-built artifacts (skips build). Requires --name.",
		)
}

/** Register a hidden backward-compat alias that copies options and action from a source command. */
function registerAlias(
	parent: InstanceType<typeof Command>,
	name: string,
	sourceCmd: InstanceType<typeof Command>,
	action: (...args: any[]) => void,
	opts?: { deprecation?: string },
) {
	const alias = parent.command(name, { hidden: true })
	for (const opt of sourceCmd.options) {
		alias.addOption(opt)
	}
	if (opts?.deprecation) {
		alias.hook("preAction", () => {
			console.warn(pc.yellow(opts.deprecation))
		})
	}
	alias.action(action)
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
				pc.dim(
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
	.option(
		"--unstableWebhookUrl <url>",
		"Webhook URL for receiving server-to-client messages (unstable)",
	)
	.option(
		"-c, --client <name>",
		`Install directly to an AI client's config (${VALID_CLIENTS.join(", ")})`,
	)
	.option(
		"--config <json>",
		"Configuration data as JSON for client install (skips prompts)",
	)
	.addHelpText(
		"after",
		`
Examples:
  smithery mcp add https://server.smithery.ai/exa
  smithery mcp add https://server.smithery.ai/exa --id exa --name "Exa Search"
  smithery mcp add anthropic/exa --client claude`,
	)
	.action(handleMcpAdd)

mcpCmd
	.command("list")
	.description("List your connections")
	.option("--namespace <ns>", "Namespace to list from")
	.option("--limit <n>", "Maximum number of results (default: all)")
	.option("--cursor <cursor>", "Pagination cursor from previous response")
	.option(
		"-c, --client <name>",
		`List servers installed in an AI client's config (${VALID_CLIENTS.join(", ")})`,
	)

	.addHelpText(
		"after",
		`
Examples:
  smithery mcp list
  smithery mcp list --client claude-code
  smithery mcp list --json`,
	)
	.action(handleListConnections)

mcpCmd
	.command("get <id>")
	.description("Get connection details")
	.option("--namespace <ns>", "Namespace for the connection")

	.action(handleGetConnection)

const removeCmd = mcpCmd
	.command("remove <ids...>")
	.description("Remove connections")
	.option("--namespace <ns>", "Namespace for the server")
	.option(
		"-c, --client <name>",
		`Uninstall from an AI client's config (${VALID_CLIENTS.join(", ")})`,
	)

	.action(handleMcpRemove)

registerAlias(mcpCmd, "rm <ids...>", removeCmd, handleMcpRemove)

mcpCmd
	.command("update <id>")
	.description("Update a connection's name, metadata, or headers")
	.option("--name <name>", "Human-readable name")
	.option("--metadata <json>", "Metadata as JSON object")
	.option("--headers <json>", "Custom headers as JSON object (stored securely)")
	.option("--namespace <ns>", "Namespace for the server")
	.action(handleUpdateConnection)

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
			pc.yellow(
				"Note: 'mcp install' is deprecated. Use 'smithery mcp add <server> --client <name>' instead.",
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
			pc.yellow(
				"Note: 'mcp uninstall' is deprecated. Use 'smithery mcp remove <server> --client <name>' instead.",
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

// ─── Logs (hidden — not GA) ─────────────────────────────────────────────────

mcpCmd
	.command("logs <server>", { hidden: true })
	.description("View runtime logs for a published server")
	.option(
		"--from <datetime>",
		"Start of time range (UTC, e.g. 2026-02-24 09:00:00)",
	)
	.option(
		"--to <datetime>",
		"End of time range (UTC, e.g. 2026-02-24 10:00:00)",
	)
	.option("--limit <n>", "Max invocations to return (default: 20)")
	.option("--search <text>", "Filter logs by text")
	.addHelpText(
		"after",
		`
Examples:
  smithery mcp logs my-org/my-server
  smithery mcp logs my-org/my-server --search "error"
  smithery mcp logs my-org/my-server --from "2026-02-24 09:00:00" --limit 50`,
	)
	.action(handleLogs)

// ─── Secrets (hidden — not GA) ──────────────────────────────────────────────

const secretsCmd = mcpCmd
	.command("secrets", { hidden: true })
	.description("Manage secrets for published MCP servers")

secretsCmd
	.command("list <server>")
	.description("List secret names for a server")
	.addHelpText(
		"after",
		`
Examples:
  smithery mcp secrets list my-org/my-server
  smithery mcp secrets list my-org/my-server --json`,
	)
	.action(handleSecretsList)

secretsCmd
	.command("set <server> [name] [value]")
	.description("Set a secret for a server")
	.addHelpText(
		"after",
		`
Examples:
  smithery mcp secrets set my-org/my-server API_KEY sk-xxx
  smithery mcp secrets set my-org/my-server`,
	)
	.action(handleSecretsSet)

secretsCmd
	.command("delete <server> <name>")
	.description("Delete a secret from a server")
	.addHelpText(
		"after",
		`
Examples:
  smithery mcp secrets delete my-org/my-server API_KEY`,
	)
	.action(handleSecretsDelete)

// ═══════════════════════════════════════════════════════════════════════════════
// Tool command — Find and call tools from MCP servers added via 'smithery mcp'
// ═══════════════════════════════════════════════════════════════════════════════

const toolCmd = program
	.command("tool")
	.description("Find and call tools from MCP servers added via 'smithery mcp'")

toolCmd
	.command("find [query]")
	.description("Find tools across your connected MCP servers")
	.option("--connection <id>", "Limit search to a specific connection")
	.option("--namespace <ns>", "Namespace to search in")
	.option("--match <mode>", "Match mode: fuzzy, substring, or exact")
	.option("--limit <n>", "Maximum number of tools to return (default: 10)")
	.option("--page <n>", "Page number (default: 1)")
	.option("--all", "Return all matches without pagination")

	.addHelpText(
		"after",
		`
Examples:
  smithery tool find "create issue"                      Find by intent across connections
  smithery tool find --connection github --all           Show all tools for one connection
  smithery tool find notion-fetch --match exact --json   Exact match as JSON`,
	)
	.action(handleFindTools)

toolCmd
	.command("list [connection]")
	.description("List tools from your connected MCP servers")
	.option("--namespace <ns>", "Namespace to list from")
	.option("--limit <n>", "Maximum number of tools to return (default: 10)")
	.option("--page <n>", "Page number (default: 1)")

	.addHelpText(
		"after",
		`
Examples:
  smithery tool list                    List tools from all connections
  smithery tool list myserver           List tools for a specific connection
  smithery tool list myserver --json    Output as JSON

Tip: Use 'smithery tool find <query>' to search tools by name or intent.`,
	)
	.action((connection, options) =>
		handleFindTools(undefined, { ...options, connection }),
	)

toolCmd
	.command("get <connection> <tool>")
	.description("Get details for a specific tool")
	.option("--namespace <ns>", "Namespace for the tool")

	.addHelpText(
		"after",
		`
Examples:
  smithery tool get myserver search     Show tool details and input schema`,
	)
	.action(handleGetTool)

toolCmd
	.command("call <connection> <tool> [args]")
	.description("Call a tool")
	.option("--namespace <ns>", "Namespace for the tool")
	.addHelpText(
		"after",
		`
Examples:
  smithery tool call myserver search '{"query":"hello"}'
  smithery tool call exa web_search_exa '{"query":"AI tools"}'`,
	)
	.action(handleCallTool)

// ═══════════════════════════════════════════════════════════════════════════════
// Event command (hidden/alpha) — Subscribe to event streams from MCP servers
// ═══════════════════════════════════════════════════════════════════════════════

const eventCmd = program
	.command("event", { hidden: true })
	.description("Subscribe to event streams from MCP servers")

eventCmd
	.command("topics <connection>")
	.description("List available event topics for a connection")
	.option("--namespace <ns>", "Namespace for the connection")
	.action(async (connection: string, options: any) => {
		const { listTopics } = await import("./commands/event")
		await listTopics(connection, options)
	})

eventCmd
	.command("subscribe <connection> <topic> [args]")
	.description("Subscribe to events from a topic")
	.option("--namespace <ns>", "Namespace for the connection")
	.addHelpText(
		"after",
		`
Examples:
  smithery event subscribe myserver slack/message.created
  smithery event subscribe myserver slack/message.created '{"channel":"C0123456"}'`,
	)
	.action(
		async (
			connection: string,
			topic: string,
			args: string | undefined,
			options: any,
		) => {
			const { subscribeEvents } = await import("./commands/event")
			await subscribeEvents(connection, topic, args, options)
		},
	)

eventCmd
	.command("unsubscribe <connection> <topic>")
	.description("Unsubscribe from an event topic")
	.option("--namespace <ns>", "Namespace for the connection")
	.addHelpText(
		"after",
		`
Examples:
  smithery event unsubscribe myserver slack/message.created`,
	)
	.action(async (connection: string, topic: string, options: any) => {
		const { unsubscribeEvents } = await import("./commands/event")
		await unsubscribeEvents(connection, topic, options)
	})

eventCmd
	.command("poll <connection>")
	.description("Poll for queued events from a connection")
	.option("--namespace <ns>", "Namespace for the connection")
	.option("--limit <n>", "Maximum events to return (1-100, default 100)")
	.action(async (connection: string, options: any) => {
		const { pollEvents } = await import("./commands/event")
		await pollEvents(connection, options)
	})

// ═══════════════════════════════════════════════════════════════════════════════
// Skill command — Search, view, and install Smithery skills
// ═══════════════════════════════════════════════════════════════════════════════

const skillCmd = program
	.command("skill")
	.description("Search, view, and install Smithery skills")

skillCmd
	.command("agents")
	.description("List available agents for skill installation")
	.action(() => {
		console.log(pc.bold("Available agents:"))
		console.log()
		for (const agent of SKILL_AGENTS) {
			console.log(`  ${agent}`)
		}
		console.log()
		console.log(
			pc.dim("See https://github.com/vercel-labs/skills for more info"),
		)
	})

skillCmd
	.command("search <query>")
	.description("Search for skills in the Smithery registry")
	.option("-i, --interactive", "Interactive search mode")
	.option("--limit <number>", "Maximum number of results to show", "10")
	.option("--page <number>", "Page number", "1")
	.option("--namespace <namespace>", "Filter by namespace")
	.action(async (query, options) => {
		const { searchSkills } = await import("./commands/skill")
		await searchSkills(query, {
			interactive: options.interactive,
			limit: Number.parseInt(options.limit, 10),
			page: Number.parseInt(options.page, 10),
			namespace: options.namespace,
		})
	})

skillCmd
	.command("view <identifier>")
	.description("View a skill's documentation without installing")
	.action(async (identifier) => {
		const { viewSkill } = await import("./commands/skill")
		await viewSkill(identifier)
	})

skillCmd
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
		const { installSkill } = await import("./commands/skill")
		await installSkill(skill, options.agent, {
			global: options.global,
			yes: !!options.agent,
		})
	})

// Skill voting (verbs instead of flags)
skillCmd
	.command("upvote <skill>")
	.description("Upvote a skill")
	.action(async (skill) => {
		const { voteSkill } = await import("./commands/skill")
		await voteSkill(skill, "up")
	})

skillCmd
	.command("downvote <skill>")
	.description("Downvote a skill")
	.action(async (skill) => {
		const { voteSkill } = await import("./commands/skill")
		await voteSkill(skill, "down")
	})

// skill review subcommand
const skillReview = skillCmd
	.command("review")
	.description("Manage skill reviews")

skillReview
	.command("list <skill>")
	.description("List reviews for a skill")

	.option("--limit <number>", "Number of reviews to show", "10")
	.option("--page <number>", "Page number", "1")
	.action(async (skill, options) => {
		const { listReviews } = await import("./commands/skill")
		await listReviews(skill, {
			limit: Number.parseInt(options.limit, 10),
			page: Number.parseInt(options.page, 10),
		})
	})

skillReview
	.command("add <skill>")
	.description("Add a review for a skill")
	.option("-b, --body <text>", "Review text (required)")
	.option("-m, --model <name>", "Agent model used (e.g., claude-3.5-sonnet)")
	.option("--up", "Upvote the skill")
	.option("--down", "Downvote the skill")
	.action(async (skill, options) => {
		if (!options.body) {
			console.error(pc.red("Error: --body is required"))
			console.error(
				pc.dim(
					'Usage: smithery skill review add <skill> --up|--down -b "review text"',
				),
			)
			process.exit(1)
		}
		if (!options.up && !options.down) {
			console.error(pc.red("Error: --up or --down is required"))
			console.error(
				pc.dim(
					'Usage: smithery skill review add <skill> --up|--down -b "review text"',
				),
			)
			process.exit(1)
		}
		if (options.up && options.down) {
			console.error(pc.red("Error: Cannot specify both --up and --down"))
			process.exit(1)
		}
		const { submitReview } = await import("./commands/skill")
		await submitReview(skill, {
			review: options.body,
			model: options.model,
			vote: options.up ? "up" : "down",
		})
	})

const reviewRemoveCmd = skillReview
	.command("remove <skill>")
	.description("Remove your review for a skill")
	.action(async (skill) => {
		const { deleteReview } = await import("./commands/skill")
		await deleteReview(skill)
	})

registerAlias(skillReview, "rm <skill>", reviewRemoveCmd, async (skill) => {
	const { deleteReview } = await import("./commands/skill")
	await deleteReview(skill)
})

skillReview
	.command("upvote <skill> <review-id>")
	.description("Upvote a review")
	.action(async (skill, reviewId) => {
		const { voteReview } = await import("./commands/skill")
		await voteReview(skill, reviewId, "up")
	})

skillReview
	.command("downvote <skill> <review-id>")
	.description("Downvote a review")
	.action(async (skill, reviewId) => {
		const { voteReview } = await import("./commands/skill")
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
		const { installSkill } = await import("./commands/skill")
		await installSkill("smithery-ai/cli", options.agent, {
			global: options.global ?? true,
			yes: true,
		})
	})

// Namespace command - manage namespace context
const namespace = program
	.command("namespace")
	.description("Manage namespace context")

namespace
	.command("list")
	.description("List available namespaces")

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

registerAlias(program, "install [server]", mcpInstallCmd, handleInstall, {
	deprecation:
		"Note: 'install' is deprecated. Use 'smithery mcp add <server> --client <name>' instead.",
})
registerAlias(program, "uninstall [server]", mcpUninstallCmd, handleUninstall, {
	deprecation:
		"Note: 'uninstall' is deprecated. Use 'smithery mcp remove <server> --client <name>' instead.",
})
registerAlias(program, "run <server>", runCmd, handleRun)
registerAlias(program, "search [term]", searchCmd, handleSearch)
registerAlias(program, "dev [entryFile]", devCmd, handleDev)
registerAlias(program, "build [entryFile]", buildCmd, handleBuild)
registerAlias(program, "publish [server]", publishCmd, handlePublish)
program.command("login", { hidden: true }).action(handleLogin)
program.command("logout", { hidden: true }).action(handleLogout)
registerAlias(program, "whoami", whoamiCmd, handleWhoami)

const serversCompat = program
	.command("servers", { hidden: true })
	.description("Search and browse MCP servers")
registerAlias(serversCompat, "search [term]", searchCmd, handleSearch)

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
	const globalOpts = program.opts()
	const localOpts = actionCommand.opts()
	const allFlags = [
		...Object.keys(globalOpts).filter((k) => globalOpts[k] !== undefined),
		...Object.keys(localOpts).filter((k) => localOpts[k] !== undefined),
	]
	const isAgent = allFlags.includes("json") || !process.stdin.isTTY
	trackEvent("command_invocation", {
		command: commandPath,
		flags: allFlags,
		isAgent,
	})
})

// ═══════════════════════════════════════════════════════════════════════════════
// Entry point
// ═══════════════════════════════════════════════════════════════════════════════

// Show help when no command is provided
if (process.argv.length <= 2) {
	program.help()
}

// Backward compat: accept plural forms
const COMMAND_ALIASES: Record<string, string> = {
	tools: "tool",
	skills: "skill",
	events: "event",
}
const argv = process.argv.slice()
if (argv[2] && argv[2] in COMMAND_ALIASES) {
	argv[2] = COMMAND_ALIASES[argv[2]]
}

// Parse arguments and run
program.parseAsync(argv).catch((error: unknown) => {
	if (error instanceof Error) {
		console.error(pc.red(`\n✗ ${error.message}`))
		if (process.argv.includes("--debug") && error.stack) {
			console.error(pc.gray(error.stack))
		}
	} else {
		console.error(pc.red(`\n✗ ${String(error)}`))
	}
	process.exit(1)
})
