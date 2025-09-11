#!/usr/bin/env node

import chalk from "chalk"
import { Command } from "commander"
import { dev } from "./commands/dev"
import { inspectServer } from "./commands/inspect"
import { installServer } from "./commands/install"
import { list } from "./commands/list"
import { playground } from "./commands/playground"
import { run } from "./commands/run/index"
import { uninstallServer } from "./commands/uninstall"
import { type ValidClient, VALID_CLIENTS } from "./config/clients"
import { setVerbose, setDebug } from "./lib/logger"
import type { ServerConfig } from "./types/registry"
import { searchServers } from "./lib/registry"
import { ensureApiKey, promptForApiKey } from "./utils/runtime"
import { build } from "./commands/build"
import { setApiKey } from "./utils/smithery-config"

const program = new Command()

// Configure the CLI
program
	.name("smithery")
	.description("Smithery CLI - Manage and run MCP servers")
	.option("--verbose", "Show detailed logs")
	.option("--debug", "Show debug logs")
	.hook("preAction", (thisCommand, actionCommand) => {
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
	.description("Install a package")
	.option(
		"--client <name>",
		`Specify the AI client (${VALID_CLIENTS.join(", ")})`,
	)
	.option(
		"--config <json>",
		"Provide configuration data as JSON (skips prompts)",
	)
	.option("--key <apikey>", "Provide an API key")
	.option("--profile <name>", "Use a specific profile")
	.action(async (server, options) => {
		let selectedServer = server
		let selectedClient = options.client

		// Step 1: Select client if not provided
		if (!selectedClient) {
			console.log(chalk.cyan("*"), "Installing MCP server")
			console.log()

			const inquirer = (await import("inquirer")).default
			const autocompletePrompt = (await import("inquirer-autocomplete-prompt"))
				.default
			inquirer.registerPrompt("autocomplete", autocompletePrompt)

			const { client } = await inquirer.prompt([
				{
					type: "autocomplete",
					name: "client",
					message: "Select client:",
					source: (_: unknown, input: string) => {
						const filtered = VALID_CLIENTS.filter((client) =>
							client.toLowerCase().includes((input || "").toLowerCase()),
						)
						return Promise.resolve(filtered)
					},
				},
			])
			selectedClient = client
			console.log()
		}

		// Step 2: Search and select server if not provided
		if (!selectedServer) {
			console.log(
				chalk.cyan("*"),
				"Installing MCP server for",
				chalk.cyan(selectedClient),
			)
			console.log()

			const inquirer = (await import("inquirer")).default
			const { searchTerm } = await inquirer.prompt([
				{
					type: "input",
					name: "searchTerm",
					message: "Search for servers:",
					validate: (input: string) =>
						input.trim().length > 0 || "Please enter a search term",
				},
			])

			try {
				const apiKey = await ensureApiKey(options.key)
				const ora = (await import("ora")).default
				const spinner = ora(`Searching for "${searchTerm}"...`).start()

				const servers = await searchServers(searchTerm, apiKey)

				if (servers.length === 0) {
					spinner.fail(`No servers found for "${searchTerm}"`)
					process.exit(0)
				}

				spinner.succeed(
					`Found ${servers.length} server${servers.length === 1 ? "" : "s"}`,
				)
				console.log()

				const autocompletePrompt = (
					await import("inquirer-autocomplete-prompt")
				).default
				inquirer.registerPrompt("autocomplete", autocompletePrompt)

				const { serverChoice } = await inquirer.prompt([
					{
						type: "autocomplete",
						name: "serverChoice",
						message: "Select server to install:",
						source: (_: unknown, input: string) => {
							const filtered = servers
								.filter(
									(s) =>
										s.qualifiedName
											.toLowerCase()
											.includes((input || "").toLowerCase()) ||
										s.displayName
											?.toLowerCase()
											.includes((input || "").toLowerCase()) ||
										s.description
											?.toLowerCase()
											.includes((input || "").toLowerCase()),
								)
								.map((s) => ({
									name: `${s.qualifiedName} (${s.useCount.toLocaleString()} tool calls) - ${s.displayName || s.description?.substring(0, 50) || ""}`,
									value: s.qualifiedName,
								}))
							return Promise.resolve(filtered)
						},
					},
				])
				selectedServer = serverChoice
				console.log()
			} catch (error) {
				const ora = (await import("ora")).default
				const spinner = ora().start()
				spinner.fail("Failed to search servers")
				console.error(
					chalk.red(error instanceof Error ? error.message : String(error)),
				)
				process.exit(1)
			}
		}

		// Validate client
		if (!VALID_CLIENTS.includes(selectedClient as ValidClient)) {
			console.error(
				chalk.yellow(
					`Invalid client "${selectedClient}". Valid options are: ${VALID_CLIENTS.join(", ")}`,
				),
			)
			process.exit(1)
		}

		// Parse config if provided
		let config: ServerConfig = {}
		if (options.config) {
			try {
				let rawConfig = options.config
				// Windows cmd does not interpret `'`, passes it literally
				if (rawConfig.startsWith("'") && rawConfig.endsWith("'")) {
					rawConfig = rawConfig.slice(1, -1)
				}
				let parsedConfig = JSON.parse(rawConfig)
				if (typeof parsedConfig === "string") {
					parsedConfig = JSON.parse(parsedConfig)
				}
				config = parsedConfig
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error)
				console.error(chalk.red(`Error parsing config: ${errorMessage}`))
				process.exit(1)
			}
		}

		await installServer(
			selectedServer,
			selectedClient as ValidClient,
			config,
			options.key,
			options.profile,
		)
	})

// Uninstall command
program
	.command("uninstall [server]")
	.description("Uninstall a package")
	.option(
		"--client <name>",
		`Specify the AI client (${VALID_CLIENTS.join(", ")})`,
	)
	.action(async (server, options) => {
		const { readConfig } = await import("./utils/client-config")
		let selectedClient = options.client
		let selectedServer = server

		// Step 1: Select client if not provided
		if (!selectedClient) {
			console.log(chalk.cyan("*"), "Uninstalling MCP server")

			const inquirer = (await import("inquirer")).default
			const autocompletePrompt = (await import("inquirer-autocomplete-prompt"))
				.default
			inquirer.registerPrompt("autocomplete", autocompletePrompt)

			const { client } = await inquirer.prompt([
				{
					type: "autocomplete",
					name: "client",
					message: "Select client:",
					source: (_: unknown, input: string) => {
						const filtered = VALID_CLIENTS.filter((client) =>
							client.toLowerCase().includes((input || "").toLowerCase()),
						)
						return Promise.resolve(filtered)
					},
				},
			])
			selectedClient = client
			console.log()
		}

		// Validate client
		if (!VALID_CLIENTS.includes(selectedClient as ValidClient)) {
			console.error(
				chalk.yellow(
					`Invalid client "${selectedClient}". Valid options are: ${VALID_CLIENTS.join(", ")}`,
				),
			)
			process.exit(1)
		}

		// Step 2: Select server if not provided
		if (!selectedServer) {
			console.log(
				chalk.cyan("*"),
				"Uninstalling server from",
				chalk.cyan(selectedClient),
			)
			console.log()

			const config = readConfig(selectedClient)
			const installedServers = Object.keys(config.mcpServers)

			if (installedServers.length === 0) {
				console.log(chalk.yellow(`No servers installed for ${selectedClient}`))
				process.exit(0)
			}

			const inquirer = (await import("inquirer")).default
			const autocompletePrompt = (await import("inquirer-autocomplete-prompt"))
				.default
			inquirer.registerPrompt("autocomplete", autocompletePrompt)

			const { serverName } = await inquirer.prompt([
				{
					type: "autocomplete",
					name: "serverName",
					message: `Select server to uninstall from ${selectedClient}:`,
					source: (_: unknown, input: string) => {
						const filtered = installedServers.filter((server) =>
							server.toLowerCase().includes((input || "").toLowerCase()),
						)
						return Promise.resolve(filtered)
					},
				},
			])
			selectedServer = serverName
		}

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
	.description("Run a server")
	.option("--config <json>", "Provide configuration as JSON")
	.option("--key <apikey>", "Provide an API key")
	.option("--profile <name>", "Use a specific profile")
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
		let config: ServerConfig = {}
		if (options.config) {
			try {
				let rawConfig = options.config
				// Windows cmd does not interpret `'`, passes it literally
				if (rawConfig.startsWith("'") && rawConfig.endsWith("'")) {
					rawConfig = rawConfig.slice(1, -1)
				}
				let parsedConfig = JSON.parse(rawConfig)
				if (typeof parsedConfig === "string") {
					parsedConfig = JSON.parse(parsedConfig)
				}
				config = parsedConfig
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error)
				console.error(chalk.red(`Error parsing config: ${errorMessage}`))
				process.exit(1)
			}
		}

		await run(
			server,
			config,
			await ensureApiKey(options.key),
			options.profile,
			{
				playground: options.playground,
				open: options.open,
				initialMessage: options.prompt,
			},
		)
	})

// Dev command
program
	.command("dev [entryFile]")
	.description("Start development server with hot-reload and tunnel")
	.option("--port <port>", "Port to run the server on (default: 8181)")
	.option("--key <apikey>", "Provide an API key")
	.option("--no-open", "Don't automatically open the playground")
	.option("--prompt <prompt>", "Initial message to start the playground with")
	.option(
		"-c, --config <path>",
		"Path to config file (default: auto-detect smithery.config.js)",
	)
	.action(async (entryFile, options) => {
		await dev({
			entryFile,
			port: options.port,
			key: options.key,
			open: options.open,
			initialMessage: options.prompt,
			configFile: options.config,
		})
	})

// Build command
program
	.command("build [entryFile]")
	.description("Build MCP server for production")
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
		})
	})

// Playground command
program
	.command("playground")
	.description("Open MCP playground in browser")
	.option("--port <port>", "Port to expose (default: 3000)")
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

// List command
program
	.command("list")
	.description("List installed servers")
	.option(
		"--client <name>",
		`Specify the AI client (${VALID_CLIENTS.join(", ")})`,
	)
	.action(async (options) => {
		let selectedClient = options.client

		// If no client provided, show interactive selection
		if (!selectedClient) {
			console.log(chalk.cyan("*"), "List installed servers")
			console.log()

			const inquirer = (await import("inquirer")).default
			const autocompletePrompt = (await import("inquirer-autocomplete-prompt"))
				.default
			inquirer.registerPrompt("autocomplete", autocompletePrompt)

			const { client } = await inquirer.prompt([
				{
					type: "autocomplete",
					name: "client",
					message: "Select client:",
					source: (_: unknown, input: string) => {
						const filtered = VALID_CLIENTS.filter((client) =>
							client.toLowerCase().includes((input || "").toLowerCase()),
						)
						return Promise.resolve(filtered)
					},
				},
			])
			selectedClient = client
			console.log()
		}

		// Validate client
		if (!VALID_CLIENTS.includes(selectedClient as ValidClient)) {
			console.error(
				chalk.yellow(
					`Invalid client "${selectedClient}". Valid options are: ${VALID_CLIENTS.join(", ")}`,
				),
			)
			process.exit(1)
		}

		await list("servers", selectedClient as ValidClient)
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
