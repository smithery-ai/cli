import chalk from "chalk"
import { errorMessage, fatal } from "../../lib/cli-error"
import { isJsonMode, outputJson } from "../../utils/output"
import { ConnectSession } from "./api"

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
				failed.push({ id, error: errorMessage(error) })
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

		if (isJsonMode()) {
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
		fatal("Failed to remove connections", error)
	}
}
