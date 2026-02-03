import chalk from "chalk"
import { ConnectSession } from "./api"
import { outputJson } from "./output"

export async function removeServer(
	serverId: string,
	options: { namespace?: string },
): Promise<void> {
	try {
		const session = await ConnectSession.create(options.namespace)
		await session.deleteConnection(serverId)
		outputJson({ success: true, removed: serverId })
	} catch (error) {
		console.error(
			chalk.red(
				`Failed to remove server: ${error instanceof Error ? error.message : String(error)}`,
			),
		)
		process.exit(1)
	}
}
