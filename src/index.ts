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
import { type ValidClient, VALID_CLIENTS } from "./constants"
import { setVerbose, setDebug } from "./logger"
import type { ServerConfig } from "./types/registry"
import { ensureApiKey, promptForApiKey } from "./utils/runtime"
import { build } from "./commands/build"
import { setApiKey } from "./smithery-config"

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
	.command("install <server>")
	.description("Install a package")
	.requiredOption(
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
		// Validate client
		if (!VALID_CLIENTS.includes(options.client as ValidClient)) {
			console.error(
				chalk.yellow(
					`Invalid client "${
						options.client
					}". Valid options are: ${VALID_CLIENTS.join(", ")}`,
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
			server,
			options.client as ValidClient,
			config,
			options.key,
			options.profile,
		)
	})

// Uninstall command
program
	.command("uninstall <server>")
	.description("Uninstall a package")
	.requiredOption(
		"--client <name>",
		`Specify the AI client (${VALID_CLIENTS.join(", ")})`,
	)
	.action(async (server, options) => {
		// Validate client
		if (!VALID_CLIENTS.includes(options.client as ValidClient)) {
			console.error(
				chalk.yellow(
					`Invalid client "${
						options.client
					}". Valid options are: ${VALID_CLIENTS.join(", ")}`,
				),
			)
			process.exit(1)
		}

		await uninstallServer(server, options.client as ValidClient)
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

		await run(server, config, await ensureApiKey(options.key), options.profile)
	})

// Dev command
program
	.command("dev [entryFile]")
	.description("Start development server with hot-reload and tunnel")
	.option("--port <port>", "Port to run the server on (default: 8181)")
	.option("--key <apikey>", "Provide an API key")
	.option("--no-open", "Don't automatically open the playground")
	.option("--prompt <prompt>", "Initial message to start the playground with")
	.action(async (entryFile, options) => {
		await dev({
			entryFile,
			port: options.port,
			key: options.key,
			open: options.open,
			initialMessage: options.prompt,
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
	.command("list <type>")
	.description("List available resources")
	.option(
		"--client <name>",
		`Specify the AI client (${VALID_CLIENTS.join(", ")})`,
	)
	.action(async (type, options) => {
		if (type === "clients") {
			await list("clients", undefined as any)
		} else if (type === "servers") {
			// For listing servers, we need a client
			if (!options.client) {
				console.error(
					chalk.yellow(
						`Please specify a client using --client. Valid options are: ${VALID_CLIENTS.join(
							", ",
						)}`,
					),
				)
				process.exit(1)
			}

			if (!VALID_CLIENTS.includes(options.client as ValidClient)) {
				console.error(
					chalk.yellow(
						`Invalid client "${
							options.client
						}". Valid options are: ${VALID_CLIENTS.join(", ")}`,
					),
				)
				process.exit(1)
			}

			await list("servers", options.client as ValidClient)
		} else {
			console.error(
				chalk.red(`Invalid list type: ${type}. Use 'clients' or 'servers'`),
			)
			process.exit(1)
		}
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
