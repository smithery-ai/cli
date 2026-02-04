#!/usr/bin/env node

import { createServer } from "node:http"
import { Smithery } from "@smithery/api/client.js"
import chalk from "chalk"
import { Command } from "commander"
import {
	addServer,
	callTool,
	listServers,
	listTools,
	removeServer,
	searchTools,
	updateServer,
} from "./commands/connect"
import { deploy } from "./commands/deploy"
import { dev } from "./commands/dev"
import { inspectServer } from "./commands/inspect"
import { installServer } from "./commands/install"
import { list } from "./commands/list"
import {
	createNamespace,
	listNamespaces,
	showNamespace,
	useNamespace,
} from "./commands/namespace"
import { playground } from "./commands/playground"
import { run } from "./commands/run/index"
import { uninstallServer } from "./commands/uninstall"
import { VALID_CLIENTS, type ValidClient } from "./config/clients"
import { DEFAULT_PORT } from "./constants"
import { buildBundle } from "./lib/bundle"
import { executeCliAuthFlow } from "./lib/cli-auth"
import { setDebug, setVerbose } from "./lib/logger"
import { searchServers, validateApiKey } from "./lib/registry"
import type { ServerConfig } from "./types/registry"
import {
	interactiveServerSearch,
	parseServerConfig,
	selectClient,
	selectInstalledServer,
	selectServer,
	validateClient,
} from "./utils/command-prompts"
import { ensureApiKey } from "./utils/runtime"
import { getApiKey, setApiKey } from "./utils/smithery-settings"

// TypeScript declaration for global constant injected at build time
declare const __SMITHERY_VERSION__: string

const program = new Command()

// Configure the CLI
program
	.name("smithery")
	.version(__SMITHERY_VERSION__)
	.description(
		`${chalk.bold.italic.hex("#ea580c")("SMITHERY CLI")} ${chalk.bold.italic.hex("#ea580c")(`v${__SMITHERY_VERSION__}`)} - Manage and run MCP servers`,
	)
	.option("--verbose", "Show detailed logs")
	.option("--debug", "Show debug logs")
	.hook("preAction", (thisCommand, _actionCommand) => {
		// Set verbose mode if flag is present
		const opts = thisCommand.opts()
		if (opts.verbose) {
			setVerbose(true)
		}
		if (opts.debug) {
			setDebug(true)
		}
	})

// Install command
program
	.command("install [server]")
	.description("install a server")
	.option(
		"-c, --client <name>",
		`Specify the AI client (${VALID_CLIENTS.join(", ")})`,
	)
	.option(
		"--config <json>",
		"Provide configuration data as JSON (skips prompts)",
	)
	.action(async (server, options) => {
		// Step 1: Select client if not provided
		const selectedClient = await selectClient(options.client, "Install")

		// Step 2: Search and select server if not provided
		const selectedServer = await selectServer(
			server,
			selectedClient,
			undefined, // No API key needed
		)

		// Validate client
		validateClient(selectedClient)

		// Parse config if provided
		const config: ServerConfig = options.config
			? parseServerConfig(options.config)
			: {}

		await installServer(selectedServer, selectedClient as ValidClient, config)
	})

// Uninstall command
program
	.command("uninstall [server]")
	.description("uninstall a server")
	.option(
		"-c, --client <name>",
		`Specify the AI client (${VALID_CLIENTS.join(", ")})`,
	)
	.action(async (server, options) => {
		const { readConfig } = await import("./lib/client-config-io")

		// Step 1: Select client if not provided
		const selectedClient = await selectClient(options.client, "Uninstall")

		// Validate client
		validateClient(selectedClient)

		// Step 2: Select server if not provided
		const config = readConfig(selectedClient)
		const installedServers = Object.keys(config.mcpServers)
		const selectedServer = await selectInstalledServer(
			server,
			selectedClient,
			installedServers,
		)

		await uninstallServer(selectedServer, selectedClient as ValidClient)
	})

// Inspect command
program
	.command("inspect <server>")
	.description("Inspect server from registry")
	.action(async (server) => {
		// API key is optional - use if available, don't prompt
		const apiKey = await getApiKey()
		await inspectServer(server, apiKey)
	})

// Run command
program
	.command("run <server>")
	.description("run a server")
	.option("--config <json>", "Provide configuration as JSON")
	.option(
		"--playground",
		"[DEPRECATED] Use 'smithery playground <server>' instead. Create playground tunnel and open playground",
	)
	.option(
		"--no-open",
		"Don't automatically open the playground (when using --playground)",
	)
	.option(
		"--prompt <prompt>",
		"Initial message to start the playground with (when using --playground)",
	)
	.action(async (server, options) => {
		// Handle deprecated --playground flag
		if (options.playground) {
			console.warn(
				chalk.yellow(
					"⚠ Warning: --playground flag is deprecated. Use 'smithery playground <server>' instead.",
				),
			)
			// Parse config if provided
			const config: ServerConfig = options.config
				? parseServerConfig(options.config)
				: {}
			await playground({
				server,
				configOverride: config,
				apiKey: await ensureApiKey(),
				open: options.open !== false,
				initialMessage: options.prompt,
			})
			return
		}

		// Parse config if provided
		const config: ServerConfig = options.config
			? parseServerConfig(options.config)
			: {}

		await run(server, config)
	})

// Dev command
program
	.command("dev [entryFile]")
	.description("Start development server with hot-reload and tunnel")
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
	.action(async (entryFile, options) => {
		await dev({
			entryFile,
			port: options.port,
			key: options.key,
			tunnel: options.tunnel,
			open: options.open,
			initialMessage: options.prompt,
			minify: options.minify,
		})
	})

// Build command
program
	.command("build [entryFile]")
	.description("build MCP server for production")
	.option(
		"-o, --out <dir>",
		"Output directory (default: .smithery/shttp or .smithery/stdio)",
	)
	.option(
		"-t, --transport <type>",
		"Transport type: shttp or stdio (default: shttp)",
		"shttp",
	)
	.action(async (entryFile, options) => {
		// Validate transport option
		if (!["shttp", "stdio"].includes(options.transport)) {
			console.error(
				chalk.red(
					`Invalid transport type "${options.transport}". Valid options are: shttp, stdio`,
				),
			)
			process.exit(1)
		}

		// Warn if -o looks like a file path instead of a directory
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

		await buildBundle({
			entryFile,
			outDir: options.out,
			transport: options.transport as "shttp" | "stdio",
			production: true,
		})
	})

// Publish command (with 'deploy' as deprecated alias)
program
	.command("publish [entryFile]")
	.alias("deploy")
	.description("Publish MCP server to Smithery")
	.option("-n, --name <name>", "Target server qualified name (e.g., @org/name)")
	.option(
		"-u, --url <url>",
		"External MCP server URL (publishes as external server)",
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
		"JSON Schema for external URLs (--url). Inline JSON or path to .json file",
	)
	.hook("preAction", () => {
		// Show deprecation warning if invoked as 'deploy'
		const invokedName = process.argv[2]
		if (invokedName === "deploy") {
			console.warn(
				chalk.yellow(
					"Warning: 'deploy' is deprecated. Please use 'publish' instead.",
				),
			)
		}
	})
	.action(async (entryFile, options) => {
		// Validate transport option
		if (options.transport && !["shttp", "stdio"].includes(options.transport)) {
			console.error(
				chalk.red(
					`Invalid transport type "${options.transport}". Valid options are: shttp, stdio`,
				),
			)
			process.exit(1)
		}

		await deploy({
			entryFile,
			key: options.key,
			name: options.name,
			url: options.url,
			resume: options.resume,
			transport: options.transport as "shttp" | "stdio",
			configSchema: options.configSchema,
		})
	})
	.hook("postAction", (thisCommand) => {
		const options = thisCommand.opts()
		// Tip for external URL publishes without config schema
		// TODO: link to docs
		if (options.url && !options.configSchema) {
			console.log(
				chalk.dim(
					"\nTip: Use --config-schema to define configuration options for your server.",
				),
			)
		}
	})

// Playground command
program
	.command("playground [server]")
	.description(
		"open MCP playground in browser (supports HTTP servers or STDIO MCP servers)",
	)
	.option(
		"--port <port>",
		`Port to expose (default: ${DEFAULT_PORT} for HTTP, 6969 for STDIO)`,
	)
	.option("--key <apikey>", "Provide an API key")
	.option(
		"--config <json>",
		"Provide configuration as JSON (when using server)",
	)
	.option("--no-open", "Don't automatically open the playground")
	.option("--prompt <prompt>", "Initial message to start the playground with")
	.allowUnknownOption() // Allow pass-through for command after --
	.allowExcessArguments() // Allow extra args after -- without error
	.action(async (server, options) => {
		// Extract command after -- separator
		let command: string | undefined
		const rawArgs = process.argv
		const separatorIndex = rawArgs.indexOf("--")
		if (separatorIndex !== -1 && separatorIndex + 1 < rawArgs.length) {
			command = rawArgs.slice(separatorIndex + 1).join(" ")
		}

		// Parse config if provided
		const configOverride: ServerConfig = options.config
			? parseServerConfig(options.config)
			: {}

		await playground({
			server,
			port: options.port,
			command,
			configOverride,
			apiKey: options.key,
			open: options.open !== false,
			initialMessage: options.prompt,
		})
	})

// List command
program
	.command("list")
	.description("list installed servers")
	.option(
		"-c, --client <name>",
		`Specify the client (${VALID_CLIENTS.join(", ")})`,
	)
	.action(async (options) => {
		// If no client provided, show interactive selection
		const selectedClient = await selectClient(options.client, "List")

		// Validate client
		validateClient(selectedClient)

		await list("servers", selectedClient as ValidClient)
	})

// Search command
program
	.command("search [term]")
	.description("Search for servers in the Smithery registry")
	.option("--json", "Output results as JSON (non-interactive)")
	.action(async (term, options) => {
		// API key is optional for search - use if available, don't prompt
		const apiKey = await getApiKey()

		if (options.json) {
			// Non-interactive JSON output
			if (!term) {
				console.error(
					chalk.red("Error: Search term is required when using --json"),
				)
				process.exit(1)
			}
			const servers = await searchServers(term, apiKey)
			console.log(JSON.stringify({ servers }, null, 2))
			return
		}

		await interactiveServerSearch(apiKey, term)
		// @TODO: add install flow
	})

// Login command
program
	.command("login")
	.description("Login with Smithery")
	.action(async () => {
		console.log(chalk.cyan("Login to Smithery"))
		console.log()

		try {
			// OAuth flow - uses SMITHERY_BASE_URL env var or defaults to https://smithery.ai
			const apiKey = await executeCliAuthFlow({})

			// Keep existing validation and storage
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
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			console.error(chalk.gray(errorMessage))
			process.exit(1)
		}
	})

async function mintApiKey() {
	const rootApiKey = await getApiKey()
	const client = new Smithery({ apiKey: rootApiKey })
	const token = await client.tokens.create({
		allow: {
			connections: {
				actions: ["read", "write"],
				namespaces: ["*"],
				metadata: {
					userId: "root-whoami",
				},
			},
			mcp: {
				actions: ["read", "write"],
				namespaces: ["*"],
				metadata: {
					userId: "root-whoami",
				},
			},
			namespaces: {
				actions: ["read", "write"],
				namespaces: ["*"],
			},
			deployments: {
				actions: ["read", "write"],
				namespaces: ["*"],
			},
			servers: {
				actions: ["read", "write"],
				namespaces: ["*"],
			},
			tokens: {
				actions: ["read", "write"],
				namespaces: ["*"],
			},
		},
		ttlSeconds: 3600,
	})
	const apiKey = token.token
	const expiresAt = new Date(token.expiresAt)
	return { apiKey, expiresAt }
}

// Show API key command
program
	.command("whoami")
	.description("Display the currently logged in API key")
	.option("--full", "Show the full API key instead of masking it")
	.option(
		"--server",
		"Start an HTTP server on localhost:4260 that serves the API key",
	)
	.action(async (options) => {
		try {
			let { apiKey, expiresAt } = await mintApiKey()

			if (!apiKey) {
				console.log(chalk.yellow("No API key found"))
				console.log(chalk.gray("Run 'smithery login' to authenticate"))
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
		} catch (error) {
			console.error(chalk.red("✗ Failed to retrieve API key"))
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			console.error(chalk.gray(errorMessage))
			process.exit(1)
		}
	})

// Namespace command - manage namespace context
const namespace = program
	.command("namespace")
	.description("Manage namespace context (like kubectl config)")

namespace
	.command("list")
	.description("List available namespaces")
	.action(async () => {
		await listNamespaces()
	})

namespace
	.command("use <name>")
	.description("Set current namespace")
	.action(async (name) => {
		await useNamespace(name)
	})

namespace
	.command("show")
	.description("Show current namespace")
	.action(async () => {
		await showNamespace()
	})

namespace
	.command("create <name>")
	.description("Create and claim a new namespace")
	.action(async (name) => {
		await createNamespace(name)
	})

// Connect command - manage MCP server connections and tools
const connect = program
	.command("connect")
	.description("Manage MCP server connections (Smithery Connect)")

connect
	.command("add <mcp-url>")
	.description("Add an MCP server connection")
	.option("--id <id>", "Custom connection ID (semantically memorable)")
	.option("--name <name>", "Human-readable name for the server")
	.option("--metadata <json>", "Custom metadata as JSON object")
	.option("--namespace <ns>", "Target namespace")
	.action(async (mcpUrl, options) => {
		await addServer(mcpUrl, options)
	})

connect
	.command("list")
	.description("List connected servers")
	.option("--namespace <ns>", "Namespace to list from")
	.action(async (options) => {
		await listServers(options)
	})

connect
	.command("remove <id>")
	.description("Remove a server connection")
	.option("--namespace <ns>", "Namespace for the server")
	.action(async (id, options) => {
		await removeServer(id, options)
	})

connect
	.command("update <id>")
	.description("Update a server connection's name or metadata")
	.option("--name <name>", "New human-readable name")
	.option(
		"--metadata <json>",
		"New metadata as JSON object (merged with existing)",
	)
	.option("--namespace <ns>", "Namespace for the server")
	.action(async (id, options) => {
		await updateServer(id, options)
	})

connect
	.command("tools [server]")
	.description("List tools (all or for a specific server)")
	.option("--namespace <ns>", "Namespace to list from")
	.action(async (server, options) => {
		await listTools(server, options)
	})

connect
	.command("search <query>")
	.description("Search tools by intent")
	.option("--namespace <ns>", "Namespace to search in")
	.action(async (query, options) => {
		await searchTools(query, options)
	})

connect
	.command("call <tool-id> [args]")
	.description("Call a tool (format: server/tool-name)")
	.option("--namespace <ns>", "Namespace for the tool")
	.action(async (toolId, args, options) => {
		await callTool(toolId, args, options)
	})

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
