#!/usr/bin/env node

import { installServer } from "./install.js"
import { uninstall } from "./commands/uninstall.js"
import { listInstalledServers } from "./commands/installed.js"
import { get } from "./commands/view.js"
import { inspect } from "./commands/inspect.js"
import { run } from "./commands/run.js"
import { type ValidClient, VALID_CLIENTS } from "./constants.js"
import chalk from "chalk"

const command = process.argv[2]
const packageName = process.argv[3]
const clientFlag = process.argv.indexOf("--client")
const configFlag = process.argv.indexOf("--config")

const validateClient = (command: string, clientFlag: number): ValidClient | undefined => {
	/* Run command doesn't need client validation */
	if (command === "run") {
		return undefined;
	}

	/* For other commands, client is required */
	if (clientFlag === -1) {
		console.error(chalk.yellow(`Please specify a client using --client. Valid options are: ${VALID_CLIENTS.join(", ")}`))
		process.exit(1)
	}

	/* only accept valid clients */
	const requestedClient = process.argv[clientFlag + 1]
	if (!VALID_CLIENTS.includes(requestedClient as ValidClient)) {
		console.error(chalk.yellow(`Invalid client "${requestedClient}". Valid options are: ${VALID_CLIENTS.join(", ")}`))
		process.exit(1)
	}

	return requestedClient as ValidClient;
}

const client = validateClient(command, clientFlag);
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
			await inspect(client!)
			break
		case "install":
			if (!packageName) {
				console.error("Please provide a package name to install")
				process.exit(1)
			}
			await installServer(packageName, client!)
			break
		case "uninstall":
			await uninstall(packageName, client!)
			break
		case "installed":
			await listInstalledServers(client!)
			break
		case "view":
			if (!packageName) {
				console.error("Please provide a package ID to get details")
				process.exit(1)
			}
			await get(packageName, client!)
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
			process.exit(1)
	}
}

main()
