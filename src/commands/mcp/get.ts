import { fatal } from "../../lib/cli-error"
import { ConnectSession } from "./api"
import { outputConnectionDetail } from "./output-connection"

export async function getServer(
	id: string,
	options: {
		namespace?: string
	},
): Promise<void> {
	try {
		const session = await ConnectSession.create(options.namespace)
		const connection = await session.getConnection(id)
		outputConnectionDetail({
			connection,
			tip: `Use smithery tool list ${id} to view tools for this connection.`,
		})
	} catch (error) {
		fatal("Failed to get connection", error)
	}
}
