import chalk from "chalk"
import { isJsonMode, outputDetail } from "../../utils/output"
import { ConnectSession } from "./api"
import { formatConnectionOutput } from "./format-connection"

export async function getServer(
	id: string,
	options: {
		namespace?: string
		json?: boolean
		table?: boolean
	},
): Promise<void> {
	try {
		const session = await ConnectSession.create(options.namespace)
		const connection = await session.getConnection(id)
		const data = formatConnectionOutput(connection)
		outputDetail({
			data,
			json: isJsonMode(options),
			tip: `Use smithery tools list ${id} to list tools for this connection.`,
		})
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(chalk.red(`Failed to get connection: ${errorMessage}`))
		process.exit(1)
	}
}
