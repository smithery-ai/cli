import chalk from "chalk"
import { ConnectSession } from "./api"
import { outputJson } from "./output"

export async function removeServer(
	serverIds: string[],
	options: { namespace?: string },
): Promise<void> {
	try {
		const session = await ConnectSession.create(options.namespace)
		const removed: string[] = []
		const failed: { id: string; error: string }[] = []

		for (const id of serverIds) {
			try {
				await session.deleteConnection(id)
				removed.push(id)
			} catch (error) {
				failed.push({
					id,
					error: error instanceof Error ? error.message : String(error),
				})
			}
		}

		if (failed.length > 0 && removed.length === 0) {
			// All failed
			console.error(chalk.red(`Failed to remove connections:`))
			for (const f of failed) {
				console.error(chalk.red(`  ${f.id}: ${f.error}`))
			}
			process.exit(1)
		}

		outputJson({ removed, failed: failed.length > 0 ? failed : undefined })
	} catch (error) {
		console.error(
			chalk.red(
				`Failed to remove connections: ${error instanceof Error ? error.message : String(error)}`,
			),
		)
		process.exit(1)
	}
}
