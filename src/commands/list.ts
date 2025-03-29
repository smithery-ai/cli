import { VALID_CLIENTS } from "../constants"
import chalk from "chalk"

export async function list(subcommand: string | undefined) {
	switch (subcommand) {
		case "clients":
			console.log(chalk.bold("Available clients:"))
			VALID_CLIENTS.forEach((client) => console.log(`  ${chalk.green(client)}`))
			break
		case "servers":
			console.log(chalk.bold("Installed servers of cline:"))
			console.log(chalk.green("[enable]  github"))
			console.log(chalk.gray("[disable] fetch"))
			console.log(chalk.green("[enable]  slack"))
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
