import chalk from "chalk"
import { ConnectSession } from "./api"
import { formatConnectionOutput } from "./format-connection"
import { outputJson } from "./output"

export async function getServer(
	id: string,
	options: {
		namespace?: string
	},
): Promise<void> {
	try {
		const session = await ConnectSession.create(options.namespace)
		const connection = await session.getConnection(id)
		const output = formatConnectionOutput(connection)
		outputJson(output)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(chalk.red(`Failed to get connection: ${errorMessage}`))
		process.exit(1)
	}
}
