#!/usr/bin/env node

import { install } from "./commands/install.js"
import { uninstall } from "./commands/uninstall.js"
import { listInstalledServers } from "./commands/installed.js"
import { get } from "./commands/view.js"
import { inspect } from "./commands/inspect.js"
import { type ValidClient } from "./constants.js"
import chalk from "chalk"

const command = process.argv[2]
const packageName = process.argv[3]
const clientFlag = process.argv.indexOf("--client")
const client = clientFlag !== -1 ? process.argv[clientFlag + 1] as ValidClient : "claude"
if (clientFlag === -1) {
	console.log(chalk.yellow("Client not provided, defaulting to claude"))
}

async function main() {
	switch (command) {
		case "inspect":
			await inspect(client)
			break
		case "install":
			if (!packageName) {
				console.error("Please provide a package name to install")
				process.exit(1)
			}
			await install(packageName, client)
			break
		case "uninstall":
			await uninstall(packageName, client)
			break
		case "installed":
			await listInstalledServers(client)
			break
		case "view":
			if (!packageName) {
				console.error("Please provide a package ID to get details")
				process.exit(1)
			}
			await get(packageName, client)
			break
		default:
			console.log("Available commands:")
			console.log("  install <package>     Install a package")
			console.log("    --client <name>     Specify the AI client")
			console.log("  uninstall [package]   Uninstall a package")
			console.log("  installed             List installed packages")
			console.log("  view <package>        Get details for a specific package")
			console.log("  inspect               Inspect installed servers")
			process.exit(1)
	}
}

main()
