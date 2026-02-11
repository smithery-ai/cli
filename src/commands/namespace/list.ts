import { createSmitheryClient } from "../../lib/smithery-client"
import { outputTable } from "../../utils/output"
import { getNamespace } from "../../utils/smithery-settings"

export async function listNamespaces(options: {
	json?: boolean
}): Promise<void> {
	const isJson = options.json ?? false
	const client = await createSmitheryClient()
	const { namespaces } = await client.namespaces.list()
	const current = await getNamespace()

	const data = namespaces.map((ns) => ({
		name: ns.name,
		current: ns.name === current ? "✓" : "",
	}))

	outputTable({
		data,
		columns: [
			{ key: "name", header: "NAME" },
			{ key: "current", header: "CURRENT" },
		],
		json: isJson,
		jsonData: {
			namespaces: namespaces.map((ns) => ns.name),
			current: current ?? null,
		},
		tip: "Use smithery namespace use <name> to switch namespaces.",
	})
}
