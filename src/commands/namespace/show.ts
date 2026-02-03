import chalk from "chalk"
import { getNamespace } from "../../utils/smithery-settings"

export async function showNamespace(): Promise<void> {
	const namespace = await getNamespace()

	if (!namespace) {
		console.error(
			chalk.yellow(
				"No namespace set. Run 'smithery namespace use <name>' first.",
			),
		)
		process.exit(1)
	}

	console.log(namespace)
}
