import pc from "picocolors"
import { createSmitheryClient } from "../../lib/smithery-client"
import { setNamespace } from "../../utils/smithery-settings"

export async function useNamespace(name: string): Promise<void> {
	// Verify namespace exists
	const client = await createSmitheryClient()
	const { namespaces } = await client.namespaces.list()
	const exists = namespaces.some((ns) => ns.name === name)

	if (!exists) {
		console.error(pc.red(`Namespace "${name}" not found.`))
		console.error(
			pc.gray(
				`Available namespaces: ${namespaces.map((ns) => ns.name).join(", ")}`,
			),
		)
		process.exit(1)
	}

	const result = await setNamespace(name)
	if (!result.success) {
		console.error(pc.red("Failed to save namespace setting."))
		console.error(pc.gray(result.error))
		process.exit(1)
	}

	console.log(pc.green(`Switched to namespace: ${name}`))
}
