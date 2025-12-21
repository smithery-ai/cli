#!/usr/bin/env node

import chalk from "chalk"
import { Command } from "commander"
import { build } from "./commands/build"
import { dev } from "./commands/dev"
import { inspectServer } from "./commands/inspect"
import { installServer } from "./commands/install"
import { list } from "./commands/list"
import { playground } from "./commands/playground"
import { run } from "./commands/run/index"
import { uninstallServer } from "./commands/uninstall"
import { VALID_CLIENTS, type ValidClient } from "./config/clients"
import { DEFAULT_PORT } from "./constants"
import { setDebug, setVerbose } from "./lib/logger"
import { validateApiKey } from "./lib/registry"
import type { ServerConfig } from "./types/registry"
import {
	interactiveServerSearch,
	parseConfigOption,
	selectClient,
	selectInstalledServer,
	selectServer,
	validateClient,
} from "./utils/command-prompts"
import { ensureApiKey, promptForApiKey } from "./utils/runtime"
import { setApiKey } from "./utils/smithery-settings"

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
			? parseConfigOption(options.config)
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
		const { readConfig } = await import("./utils/install/mcp-config")

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
	.option("--key <apikey>", "Provide an API key")
	.action(async (server, options) => {
		await inspectServer(server, await ensureApiKey(options.key))
	})

// Run command
program
	.command("run <server>")
	.description("run a server")
	.option("--config <json>", "Provide configuration as JSON")
	.option("--playground", "Create playground tunnel and open playground")
	.option(
		"--no-open",
		"Don't automatically open the playground (when using --playground)",
	)
	.option(
		"--prompt <prompt>",
		"Initial message to start the playground with (when using --playground)",
	)
	.action(async (server, options) => {
		// Parse config if provided
		const config: ServerConfig = options.config
			? parseConfigOption(options.config)
			: {}

		await run(server, config, {
			playground: options.playground,
			open: options.open,
			initialMessage: options.prompt,
		})
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
		"-c, --config <path>",
		"Path to config file (default: auto-detect smithery.config.js)",
	)
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
			configFile: options.config,
			minify: options.minify,
		})
	})

// Build command
program
	.command("build [entryFile]")
	.description("build MCP server for production")
	.option(
		"-o, --out <outfile>",
		"Output file path (default: .smithery/index.cjs)",
	)
	.option(
		"--transport <type>",
		"Transport type: shttp or stdio (default: shttp)",
	)
	.option(
		"-c, --config <path>",
		"Path to config file (default: auto-detect smithery.config.js)",
	)
	.action(async (entryFile, options) => {
		// Validate transport option
		const transport = options.transport || "shttp"
		if (!["shttp", "stdio"].includes(transport)) {
			console.error(
				chalk.red(
					`Invalid transport type "${transport}". Valid options are: shttp, stdio`,
				),
			)
			process.exit(1)
		}

		await build({
			entryFile,
			outFile: options.out,
			transport: transport as "shttp" | "stdio",
			configFile: options.config,
			bundleAll: options.bundleAll,
		})
	})

// Playground command
program
	.command("playground")
	.description("open MCP playground in browser")
	.option("--port <port>", `Port to expose (default: ${DEFAULT_PORT})`)
	.option("--key <apikey>", "Provide an API key")
	.allowUnknownOption() // Allow pass-through for command after --
	.allowExcessArguments() // Allow extra args after -- without error
	.action(async (options) => {
		// Extract command after -- separator
		let command: string | undefined
		const rawArgs = process.argv
		const separatorIndex = rawArgs.indexOf("--")
		if (separatorIndex !== -1 && separatorIndex + 1 < rawArgs.length) {
			command = rawArgs.slice(separatorIndex + 1).join(" ")
		}

		await playground({
			port: options.port,
			command,
			apiKey: await ensureApiKey(options.key),
		})
	})

// Playground STDIO command
program
	.command("playground-stdio")
	.description("Run arbitrary command as stdio MCP server in playground")
	.option("--port <port>", "Port for HTTP server (default: 6969)")
	.option("--key <apikey>", "Provide an API key")
	.option("--no-open", "Don't automatically open the playground")
	.option("--prompt <prompt>", "Initial message to start the playground with")
	.allowUnknownOption() // Allow pass-through for command after --
	.allowExcessArguments() // Allow extra args after -- without error
	.action(async (options) => {
		// Extract command after -- separator
		let command: string | undefined
		const rawArgs = process.argv
		const separatorIndex = rawArgs.indexOf("--")
		if (separatorIndex !== -1 && separatorIndex + 1 < rawArgs.length) {
			command = rawArgs.slice(separatorIndex + 1).join(" ")
		}

		if (!command) {
			console.error(chalk.red("❌ Command is required."))
			console.error(
				chalk.yellow("Usage: smithery playground-stdio -- <command>"),
			)
			console.error(
				chalk.gray(
					"Example: smithery playground-stdio -- python my_mcp_server.py",
				),
			)
			process.exit(1)
		}

		const { createArbitraryCommandRunner } = await import(
			"./commands/run/arbitrary-command-runner.js"
		)

		const _cleanup = await createArbitraryCommandRunner(
			command,
			await ensureApiKey(options.key),
			{
				port: options.port ? Number.parseInt(options.port, 10) : 6969,
				open: options.open !== false,
				initialMessage: options.prompt,
			},
		)

		// Keep the process alive
		process.stdin.resume()
		await new Promise<void>(() => {})
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
	.action(async (term) => {
		const apiKey = await ensureApiKey()
		await interactiveServerSearch(apiKey, term)
		// @TODO: add install flow
	})

// Login command
program
	.command("login")
	.description("Login with an API key")
	.action(async () => {
		console.log(chalk.cyan("Login to Smithery"))
		console.log(
			chalk.gray("Get your API key from: https://smithery.ai/account/api-keys"),
		)
		console.log()

		try {
			const apiKey = await promptForApiKey()

			// Validate API key before saving
			await validateApiKey(apiKey)

			const result = await setApiKey(apiKey)

			if (result.success) {
				console.log(chalk.green("✓ API key saved successfully"))
				console.log(chalk.gray("You can now use Smithery CLI commands"))
			} else {
				console.error(chalk.red("✗ Failed to save API key"))
				console.error(chalk.gray("You may need to enter it again next time"))
			}
		} catch (error) {
			console.error(chalk.red("✗ Login failed"))
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			console.error(chalk.gray(errorMessage))
			process.exit(1)
		}
	})

// Parse arguments and run
program.parse(process.argv)
