import chalk from "chalk"
import { outputJson } from "../../utils/output"
import { ConnectSession } from "./api"

export async function removeServer(
	serverIds: string[],
	options: { namespace?: string; json?: boolean },
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
			console.error(chalk.red(`Failed to remove connections:`))
			for (const f of failed) {
				console.error(chalk.red(`  ${f.id}: ${f.error}`))
			}
			process.exit(1)
		}

		const result = { removed, failed: failed.length > 0 ? failed : undefined }

		if (options.json) {
			outputJson(result)
		} else {
			for (const id of removed) {
				console.log(`${chalk.green("✓")} Removed ${id}`)
			}
			for (const f of result.failed ?? []) {
				console.log(`${chalk.red("✗")} ${f.id}: ${f.error}`)
			}
		}
	} catch (error) {
		console.error(
			chalk.red(
				`Failed to remove connections: ${error instanceof Error ? error.message : String(error)}`,
			),
		)
		process.exit(1)
	}
}
