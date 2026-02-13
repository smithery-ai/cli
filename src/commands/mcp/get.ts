import { fatal } from "../../lib/cli-error"
import { isJsonMode, outputDetail } from "../../utils/output"
import { ConnectSession } from "./api"
import { formatConnectionOutput } from "./format-connection"

export async function getServer(
	id: string,
	options: {
		namespace?: string
	},
): Promise<void> {
	try {
		const session = await ConnectSession.create(options.namespace)
		const connection = await session.getConnection(id)
		const data = formatConnectionOutput(connection)
		outputDetail({
			data,
			json: isJsonMode(),
			tip: `Use smithery tool list ${id} to view tools for this connection.`,
		})
	} catch (error) {
		fatal("Failed to get connection", error)
	}
}
