import { readConfig } from "../client-config"
import { VALID_CLIENTS, ValidClient } from "../constants"
import chalk from "chalk"

export async function list(subcommand: string | undefined, client: ValidClient) {
	switch (subcommand) {
		case "clients":
			console.log(chalk.bold("Available clients:"))
			VALID_CLIENTS.forEach((client) => console.log(`  ${chalk.green(client)}`))
			break
		case "servers":
			const config = readConfig(client)
			const servers = Object.keys(config.mcpServers)
			console.log(chalk.bold("Installed servers of cline:"))
			servers.forEach((server) => {
				console.log(`  ${chalk.green(server)}`)
			})
			break
		default:
			console.log(
				chalk.yellow("Please specify what to list. Available options:"),
			)
			console.log("  clients    List available clients")
			console.log("  servers    List installed servers")
			process.exit(1)
	}
}
