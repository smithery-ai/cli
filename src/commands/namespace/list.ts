import { Smithery } from "@smithery/api/client.js"
import { getApiKey, getNamespace } from "../../utils/smithery-settings"

export async function listNamespaces(): Promise<void> {
	const apiKey = await getApiKey()
	if (!apiKey) {
		console.log(
			JSON.stringify({
				error: "No API key found. Run 'smithery login' to authenticate.",
			}),
		)
		process.exit(1)
	}

	const client = new Smithery({ apiKey })
	const { namespaces } = await client.namespaces.list()
	const current = await getNamespace()

	console.log(
		JSON.stringify({
			namespaces: namespaces.map((ns) => ns.name),
			current: current ?? null,
		}),
	)
}
