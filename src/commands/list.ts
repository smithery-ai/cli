import chalk from "chalk"
import {
	getClientConfiguration,
	VALID_CLIENTS,
	type ValidClient,
} from "../config/clients"
import { fatal } from "../lib/cli-error"
import { readConfig } from "../lib/client-config-io"
import { isJsonMode, outputTable } from "../utils/output"

/**
 * List MCP servers installed in a specific AI client's config.
 */
export async function listClientServers(client: string): Promise<void> {
	const isJson = isJsonMode()

	const configTarget = getClientConfiguration(client)
	if (configTarget.install.method === "command") {
		fatal(`Listing servers is not supported for ${client}`)
	}

	const config = readConfig(client)
	const servers = Object.keys(config.mcpServers).sort()

	const data = servers.map((name) => ({ name }))

	outputTable({
		data,
		columns: [{ key: "name", header: "NAME" }],
		json: isJson,
		jsonData: { client, servers },
		tip:
			data.length === 0
				? `No servers installed for ${client}. Use smithery mcp add <url> --client ${client} to install one.`
				: `Use smithery mcp remove <name> --client ${client} to uninstall.`,
	})
}

/**
 * @deprecated Use listClientServers instead.
 */
export async function list(
	subcommand: string | undefined,
	client: ValidClient,
) {
	switch (subcommand) {
		case "clients":
			console.log(chalk.bold("Available clients:"))
			for (const c of VALID_CLIENTS) {
				console.log(`  ${chalk.green(c)}`)
			}
			break
		case "servers":
			await listClientServers(client)
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
