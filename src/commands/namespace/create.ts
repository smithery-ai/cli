import chalk from "chalk"
import { createSmitheryClient } from "../../lib/smithery-client"
import { setNamespace } from "../../utils/smithery-settings"

export async function createNamespace(name: string): Promise<void> {
	const client = await createSmitheryClient()

	try {
		await client.namespaces.set(name)
		console.log(chalk.green(`Created and claimed namespace: ${name}`))

		// Automatically switch to the new namespace
		const result = await setNamespace(name)
		if (result.success) {
			console.log(chalk.green(`Switched to namespace: ${name}`))
		}
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.toLowerCase().includes("already exists")
		) {
			console.error(chalk.red(`Namespace "${name}" already exists.`))
		} else {
			console.error(
				chalk.red(
					`Failed to create namespace: ${error instanceof Error ? error.message : String(error)}`,
				),
			)
		}
		process.exit(1)
	}
}
