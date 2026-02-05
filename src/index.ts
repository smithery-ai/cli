#!/usr/bin/env node

import { createServer } from "node:http"
import chalk from "chalk"
import { Command } from "commander"
import { SKILL_AGENTS } from "./config/agents"
import { VALID_CLIENTS, type ValidClient } from "./config/clients"
import { DEFAULT_PORT } from "./constants"
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
		const { selectClient, selectServer, parseServerConfig } = await import(
			"./utils/command-prompts"
		)
		const { installServer } = await import("./commands/install")

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
		const { selectClient, selectInstalledServer } = await import(
			"./utils/command-prompts"
		)
		const { uninstallServer } = await import("./commands/uninstall")

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
		const { inspectServer } = await import("./commands/inspect")
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
		const { parseServerConfig } = await import("./utils/command-prompts")

		// Handle deprecated --playground flag
		if (options.playground) {
			const { playground } = await import("./commands/playground")
			const { ensureApiKey } = await import("./utils/runtime")
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

		const { run } = await import("./commands/run/index")
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

		const { buildBundle } = await import("./lib/bundle")
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

		const { deploy } = await import("./commands/deploy")
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
		const { parseServerConfig } = await import("./utils/command-prompts")
		const { playground } = await import("./commands/playground")

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
		const { selectClient } = await import("./utils/command-prompts")
		const { list } = await import("./commands/list")

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
			const { searchServers } = await import("./lib/registry")
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

		const { interactiveServerSearch } = await import("./utils/command-prompts")
		await interactiveServerSearch(apiKey, term)
		// @TODO: add install flow
	})

// Login command
program
	.command("login")
	.description("Login with Smithery")
	.action(async () => {
		const { executeCliAuthFlow } = await import("./lib/cli-auth")
		const { validateApiKey } = await import("./lib/registry")

		console.log(chalk.cyan("Login to Smithery"))
		console.log()

		try {
			// OAuth flow - uses SMITHERY_BASE_URL env var or defaults to https://smithery.ai
			const apiKey = await executeCliAuthFlow()

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

// Logout command
program
	.command("logout")
	.description("Log out and remove all local credentials")
	.action(async () => {
		const { clearApiKey, clearNamespace } = await import(
			"./utils/smithery-settings"
		)
		const { clearAllConfigs } = await import("./lib/keychain.js")

		console.log(chalk.cyan("Logging out of Smithery..."))

		// Clear API key
		await clearApiKey()

		// Clear namespace
		await clearNamespace()

		// Clear keychain entries
		await clearAllConfigs()

		console.log(chalk.green("✓ Successfully logged out"))
		console.log(chalk.gray("All local credentials have been removed"))
	})

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
		const { Smithery } = await import("@smithery/api/client.js")

		async function mintApiKey() {
			const rootApiKey = await getApiKey()
			const client = new Smithery({ apiKey: rootApiKey })
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
		} catch (_error) {
			console.log(chalk.yellow("Not logged in"))
			console.log(chalk.gray("Run 'smithery login' to authenticate"))
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
		const { listNamespaces } = await import("./commands/namespace")
		await listNamespaces()
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

namespace
	.command("search [query]")
	.description("Search public namespaces (requires login)")
	.option("--limit <number>", "Maximum number of results to show", "20")
	.option("--has-skills", "Only show namespaces with skills")
	.option("--has-servers", "Only show namespaces with servers")
	.action(async (query, options) => {
		const { searchPublicNamespaces } = await import("./commands/namespace")
		await searchPublicNamespaces(query, {
			limit: Number.parseInt(options.limit, 10),
			hasSkills: options.hasSkills,
			hasServers: options.hasServers,
		})
	})

// Connect command - manage MCP server connections and tools
const connect = program
	.command("connect")
	.description("Manage MCP server connections (Smithery Connect)")

connect
	.command("add <mcp-url>")
	.description("Add an MCP server connection")
	.option(
		"--id <id>",
		"Custom connection ID (defaults name to ID if name not set)",
	)
	.option("--name <name>", "Human-readable name for the server")
	.option("--metadata <json>", "Custom metadata as JSON object")
	.option("--headers <json>", "Custom headers as JSON object (stored securely)")
	.option("--namespace <ns>", "Target namespace")
	.action(async (mcpUrl, options) => {
		const { addServer } = await import("./commands/connect")
		await addServer(mcpUrl, options)
	})

connect
	.command("list")
	.description("List connected servers")
	.option("--namespace <ns>", "Namespace to list from")
	.action(async (options) => {
		const { listServers } = await import("./commands/connect")
		await listServers(options)
	})

connect
	.command("remove <ids...>")
	.description("Remove one or more server connections")
	.option("--namespace <ns>", "Namespace for the server")
	.action(async (ids, options) => {
		const { removeServer } = await import("./commands/connect")
		await removeServer(ids, options)
	})

connect
	.command("set <id> <mcp-url>")
	.description("Create or update a connection by ID")
	.option("--name <name>", "Human-readable name")
	.option("--metadata <json>", "Metadata as JSON object")
	.option("--headers <json>", "Custom headers as JSON object (stored securely)")
	.option("--namespace <ns>", "Namespace for the server")
	.action(async (id, mcpUrl, options) => {
		const { setServer } = await import("./commands/connect")
		await setServer(id, mcpUrl, options)
	})

connect
	.command("tools [server]")
	.description("List tools (all or for a specific server)")
	.option("--namespace <ns>", "Namespace to list from")
	.action(async (server, options) => {
		const { listTools } = await import("./commands/connect")
		await listTools(server, options)
	})

connect
	.command("search <query>")
	.description("Search tools by intent")
	.option("--namespace <ns>", "Namespace to search in")
	.action(async (query, options) => {
		const { searchTools } = await import("./commands/connect")
		await searchTools(query, options)
	})

connect
	.command("call <tool-id> [args]")
	.description("Call a tool (format: server/tool-name)")
	.option("--namespace <ns>", "Namespace for the tool")
	.action(async (toolId, args, options) => {
		const { callTool } = await import("./commands/connect")
		await callTool(toolId, args, options)
	})

// Skills command - search and install skills
const skills = program
	.command("skills")
	.description("Search and install Smithery skills")

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
	.command("search [query]")
	.description("Search for skills in the Smithery registry")
	.option(
		"--json",
		"Print search results as JSON without interactive selection",
	)
	.option("--limit <number>", "Maximum number of results to show", "10")
	.option("--page <number>", "Page number", "1")
	.option("--namespace <namespace>", "Filter by namespace")
	.action(async (query, options) => {
		const { searchSkills } = await import("./commands/skills")
		await searchSkills(query, {
			json: options.json,
			limit: Number.parseInt(options.limit, 10),
			page: Number.parseInt(options.page, 10),
			namespace: options.namespace,
		})
	})

// Uses the Vercel Labs skills CLI: https://github.com/vercel-labs/skills
skills
	.command("install <skill>")
	.description("Install a skill (via github.com/vercel-labs/skills)")
	.requiredOption(
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
	.option("--limit <number>", "Number of reviews to show", "10")
	.option("--page <number>", "Page number", "1")
	.action(async (skill, options) => {
		const { listReviews } = await import("./commands/skills")
		await listReviews(skill, {
			json: options.json,
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

skillsReview
	.command("remove <skill>")
	.description("Remove your review for a skill")
	.action(async (skill) => {
		const { deleteReview } = await import("./commands/skills")
		await deleteReview(skill)
	})

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
