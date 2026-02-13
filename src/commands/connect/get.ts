import { fatal } from "../../lib/cli-error"
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
			tip: `Use smithery tools find --connection ${id} --all to view tools for this connection.`,
		})
	} catch (error) {
		fatal("Failed to get connection", error)
	}
}
