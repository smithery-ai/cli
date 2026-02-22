import pc from "picocolors"
import { getNamespace } from "../../utils/smithery-settings"

export async function showNamespace(): Promise<void> {
	const namespace = await getNamespace()

	if (!namespace) {
		console.error(
			pc.yellow("No namespace set. Run 'smithery namespace use <name>' first."),
		)
		process.exit(1)
	}

	console.log(namespace)
}
