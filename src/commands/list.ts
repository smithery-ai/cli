import { VALID_CLIENTS } from "../constants"
import chalk from "chalk"

export async function list(subcommand: string | undefined) {
	switch (subcommand) {
		case "clients":
			console.log(chalk.bold("Available clients:"))
			VALID_CLIENTS.forEach(client => console.log(`  ${chalk.green(client)}`))
			break
		default:
			console.log(chalk.yellow("Please specify what to list. Available options:"))
			console.log("  clients    List available clients")
			process.exit(1)
	}
} 