import { createSmitheryClient } from "../../lib/smithery-client"
import { getNamespace } from "../../utils/smithery-settings"

export async function listNamespaces(): Promise<void> {
	const client = await createSmitheryClient()
	const { namespaces } = await client.namespaces.list()
	const current = await getNamespace()

	console.log(
		JSON.stringify({
			namespaces: namespaces.map((ns) => ns.name),
			current: current ?? null,
		}),
	)
}
