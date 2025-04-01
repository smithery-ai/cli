import { readConfig, getConfigPath } from "../client-config"
import { VALID_CLIENTS, type ValidClient } from "../constants"
import chalk from "chalk"

export async function list(
	subcommand: string | undefined,
	client: ValidClient,
) {
	switch (subcommand) {
		case "clients":
			console.log(chalk.bold("Available clients:"))
			VALID_CLIENTS.forEach((client) => console.log(`  ${chalk.green(client)}`))
			break
		case "servers": {
			/* check if client is command-type */
			const configTarget = getConfigPath(client)
			if (configTarget.type === "command") {
				console.log(
					chalk.yellow(
						`Listing servers is currently not supported for ${client}`,
					),
				)
				return
			}

			const config = readConfig(client)
			const servers = Object.keys(config.mcpServers)
			if (servers?.length > 0) {
				console.log(chalk.bold(`Installed servers for ${client}:`))
				servers.sort().forEach((server) => {
					console.log(`${chalk.green(server)}`)
				})
			} else {
				const info = `No installed servers found for ${client}`
				console.log(`${chalk.red(info)}`)
			}

			break
		}
		default:
			console.log(
				chalk.yellow("Please specify what to list. Available options:"),
			)
			console.log("  clients    List available clients")
			console.log("  servers    List installed servers")
			process.exit(1)
	}
}
