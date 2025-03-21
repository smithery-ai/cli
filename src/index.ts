#!/usr/bin/env node

import chalk from "chalk"
import { type ValidClient, VALID_CLIENTS } from "./constants"
import { inspectServer } from "./commands/inspect"
import { installServer } from "./commands/install"
import { list } from "./commands/list"
import { setVerbose } from "./logger"
import { run } from "./commands/run/index" // use new run function
import { uninstallServer } from "./commands/uninstall"
import { ServerConfig } from "./types/registry"

const command = process.argv[2]
const argument = process.argv[3]
const clientFlag = process.argv.indexOf("--client")
const configFlag = process.argv.indexOf("--config")
const keyFlag = process.argv.indexOf("--key")
const verboseFlag = process.argv.includes("--verbose")
const helpFlag = process.argv.includes("--help")

// Set verbose mode based on flag
setVerbose(verboseFlag)

const showHelp = () => {
	console.log("Available commands:")
	console.log("  install <server>     Install a package")
	console.log("    --client <name>    Specify the AI client")
	console.log(
		"    --config <json>    Provide configuration data as JSON (skips prompts)",
	)
	console.log("    --key <apikey>     Provide an API key")
	console.log("  uninstall <server>   Uninstall a package")
	console.log("  inspect <server>     Inspect server from registry")
	console.log("  run <server>         Run a server")
	console.log("    --config <json>    Provide configuration as JSON")
	console.log("    --key <apikey>     Provide an API key")
	console.log("  list clients         List available clients")
	console.log("")
	console.log("Global options:")
	console.log("  --help               Show this help message")
	console.log("  --verbose            Show detailed logs")
	process.exit(0)
}

// Show help if --help flag is present or no command is provided
if (helpFlag || !command) {
	showHelp()
}

const validateClient = (
	command: string,
	clientFlag: number,
): ValidClient | undefined => {
	/* Run, inspect, and list commands don't need client validation */
	if (["run", "inspect", "list"].includes(command)) {
		return undefined
	}

	/* For other commands, client is required */
	if (clientFlag === -1) {
		console.error(
			chalk.yellow(
				`Please specify a client using --client. Valid options are: ${VALID_CLIENTS.join(", ")}`,
			),
		)
		process.exit(1)
	}

	/* only accept valid clients */
	const requestedClient = process.argv[clientFlag + 1]
	if (!VALID_CLIENTS.includes(requestedClient as ValidClient)) {
		console.error(
			chalk.yellow(
				`Invalid client "${requestedClient}". Valid options are: ${VALID_CLIENTS.join(", ")}`,
			),
		)
		process.exit(1)
	}

	return requestedClient as ValidClient
}

const client = validateClient(command, clientFlag)
/* config is set to empty if none given */
const config: ServerConfig =
	configFlag !== -1
		? (() => {
				try {
					let parsedConfig = JSON.parse(process.argv[configFlag + 1])
					if (typeof parsedConfig === "string") {
						parsedConfig = JSON.parse(parsedConfig)
					}
					return parsedConfig
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					console.error(chalk.red(`Error parsing config: ${errorMessage}`))
					process.exit(1)
				}
			})()
		: {}

/* sets to undefined if no key given */
const apiKey: string | undefined = keyFlag !== -1 ? process.argv[keyFlag + 1] : undefined

async function main() {
	switch (command) {
		case "inspect":
			if (!argument) {
				console.error("Please provide a server ID to inspect")
				process.exit(1)
			}
			await inspectServer(argument)
			break
		case "install":
			if (!argument) {
				console.error("Please provide a server ID to install")
				process.exit(1)
			}
			await installServer(
				argument,
				client!,
				configFlag !== -1 ? config : undefined,
				apiKey
			)
			break
		case "uninstall":
			if (!argument) {
				console.error("Please provide a server ID to uninstall")
				process.exit(1)
			}
			await uninstallServer(argument, client!)
			break
		case "run":
			if (!argument) {
				console.error("Please provide a server ID to run")
				process.exit(1)
			}
			await run(argument, config, apiKey)
			break
		case "list":
			await list(argument)
			break
		default:
			showHelp()
	}
}

main()
