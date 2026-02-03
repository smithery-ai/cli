import chalk from "chalk"
import { createSmitheryClient } from "../../lib/smithery-client"
import { setNamespace } from "../../utils/smithery-settings"

export async function useNamespace(name: string): Promise<void> {
	// Verify namespace exists
	const client = await createSmitheryClient()
	const { namespaces } = await client.namespaces.list()
	const exists = namespaces.some((ns) => ns.name === name)

	if (!exists) {
		console.error(chalk.red(`Namespace "${name}" not found.`))
		console.error(
			chalk.gray(
				`Available namespaces: ${namespaces.map((ns) => ns.name).join(", ")}`,
			),
		)
		process.exit(1)
	}

	const result = await setNamespace(name)
	if (!result.success) {
		console.error(chalk.red("Failed to save namespace setting."))
		console.error(chalk.gray(result.error))
		process.exit(1)
	}

	console.log(chalk.green(`Switched to namespace: ${name}`))
}
