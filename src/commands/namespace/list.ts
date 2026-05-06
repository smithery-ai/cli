import { createSmitheryClient } from "../../lib/smithery-client"
import { isJsonMode, outputTable } from "../../utils/output"
import { getNamespace, getProfiles } from "../../utils/smithery-settings"

export async function listNamespaces(
	_options: Record<string, unknown> = {},
): Promise<void> {
	const isJson = isJsonMode()
	const client = await createSmitheryClient()
	const { namespaces } = await client.namespaces.list()
	const current = await getNamespace()
	const profiles = await getProfiles()
	const cachedNamespaces = Object.keys(profiles)

	const data = namespaces.map((ns) => ({
		name: ns.name,
		current: ns.name === current ? "✓" : "",
		cached: cachedNamespaces.includes(ns.name) ? "✓" : "",
	}))

	outputTable({
		data,
		columns: [
			{ key: "name", header: "NAME" },
			{ key: "current", header: "CURRENT" },
			{ key: "cached", header: "CACHED" },
		],
		json: isJson,
		jsonData: {
			namespaces: namespaces.map((ns) => ns.name),
			current: current ?? null,
			cachedProfiles: cachedNamespaces,
		},
		tip: "Use smithery namespace switch <name> to switch to a cached profile instantly.",
	})
}
