#!/usr/bin/env node

import { installServer } from "./install"
import { uninstallServer } from "./uninstall"
import { inspectServer } from "./inspect"
import { run } from "./run/index" // use new run function
import { type ValidClient, VALID_CLIENTS } from "./constants"
import chalk from "chalk"
import { setVerbose } from "./logger"

const command = process.argv[2]
const packageName = process.argv[3]
const clientFlag = process.argv.indexOf("--client")
const configFlag = process.argv.indexOf("--config")
const verboseFlag = process.argv.includes("--verbose")

// Set verbose mode based on flag
setVerbose(verboseFlag)

const validateClient = (
	command: string,
	clientFlag: number,
): ValidClient | undefined => {
	/* Run and inspect commands don't need client validation */
	if (command === "run" || command === "inspect") {
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
const config =
	configFlag !== -1
		? (() => {
				let config = JSON.parse(process.argv[configFlag + 1])
				if (typeof config === "string") {
					config = JSON.parse(config)
				}
				return config
			})()
		: {}

async function main() {
	switch (command) {
		case "inspect":
			await inspectServer(packageName)
			break
		case "install":
			if (!packageName) {
				console.error("Please provide a package name to install")
				process.exit(1)
			}
			await installServer(packageName, client!)
			break
		case "uninstall":
			await uninstallServer(packageName, client!)
			break
		case "run":
			if (!packageName) {
				console.error("Please provide a server ID to run")
				process.exit(1)
			}
			await run(packageName, config)
			break
		default:
			console.log("Available commands:")
			console.log("  install <package>     Install a package")
			console.log("    --client <name>     Specify the AI client")
			console.log("  uninstall [package]   Uninstall a package")
			console.log("  installed             List installed packages")
			console.log("  view <package>        Get details for a specific package")
			console.log("  inspect               Inspect installed servers")
			console.log("  run <server-id>       Run a server")
			console.log("  --verbose             Show detailed logs")
			process.exit(1)
	}
}

main()
