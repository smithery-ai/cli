import { Smithery } from "@smithery/api/client.js"
import chalk from "chalk"
import { getApiKey, setNamespace } from "../../utils/smithery-settings"

export async function useNamespace(name: string): Promise<void> {
	const apiKey = await getApiKey()
	if (!apiKey) {
		console.error(
			chalk.red("No API key found. Run 'smithery login' to authenticate."),
		)
		process.exit(1)
	}

	// Verify namespace exists
	const client = new Smithery({ apiKey })
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
