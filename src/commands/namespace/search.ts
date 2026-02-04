import type { Smithery } from "@smithery/api/client.js"
import chalk from "chalk"
import { createSmitheryClient } from "../../lib/smithery-client"

export interface NamespaceSearchOptions {
	limit?: number
	hasSkills?: boolean
	hasServers?: boolean
}

/**
 * Search public namespaces
 * @param query - Optional search query (prefix match on name)
 * @param options - Search options
 */
export async function searchPublicNamespaces(
	query?: string,
	options: NamespaceSearchOptions = {},
): Promise<void> {
	const { limit = 20, hasSkills, hasServers } = options

	let client: Smithery
	try {
		client = await createSmitheryClient()
	} catch {
		console.error(chalk.red("Error: Not logged in."))
		console.error(chalk.dim("Run 'smithery login' to authenticate."))
		process.exit(1)
	}

	// Build query params
	const queryParams: {
		q?: string
		pageSize: number
		hasSkills?: "1" | "0"
		hasServers?: "1" | "0"
	} = {
		pageSize: limit,
	}

	if (query) {
		queryParams.q = query
	}
	if (hasSkills !== undefined) {
		queryParams.hasSkills = hasSkills ? "1" : "0"
	}
	if (hasServers !== undefined) {
		queryParams.hasServers = hasServers ? "1" : "0"
	}

	try {
		const ora = (await import("ora")).default
		const searchMsg = query
			? `Searching namespaces for "${query}"...`
			: "Listing public namespaces..."
		const spinner = ora(searchMsg).start()

		const response = await client.namespaces.list(queryParams)
		const namespaces = response.namespaces

		if (namespaces.length === 0) {
			spinner.fail(
				query ? `No namespaces found for "${query}"` : "No namespaces found",
			)
			return
		}

		spinner.succeed(
			`Found ${namespaces.length} namespace${namespaces.length === 1 ? "" : "s"}:`,
		)
		console.log()

		for (const ns of namespaces) {
			console.log(`  ${chalk.cyan(ns.name)}`)
		}
		console.log()
		console.log(
			chalk.dim(
				`Use 'smithery skills search --namespace <name>' to browse skills in a namespace`,
			),
		)
	} catch (error) {
		console.error(
			chalk.red("Error searching namespaces:"),
			error instanceof Error ? error.message : String(error),
		)
		process.exit(1)
	}
}
