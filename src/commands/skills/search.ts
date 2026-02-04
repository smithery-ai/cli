import { Smithery } from "@smithery/api/client.js"
import type { SkillListResponse } from "@smithery/api/resources/skills"
import chalk from "chalk"

export interface SearchOptions {
	json?: boolean
	limit?: number
	page?: number
	namespace?: string
}

/**
 * Prompts for a search term if not provided
 */
async function getSearchTerm(providedTerm?: string): Promise<string> {
	if (providedTerm) {
		return providedTerm
	}

	const inquirer = (await import("inquirer")).default
	const result = await inquirer.prompt([
		{
			type: "input",
			name: "searchTerm",
			message: "Search for skills:",
			validate: (input: string) =>
				input.trim().length > 0 || "Please enter a search term",
		},
	])
	console.log()
	return result.searchTerm
}

/**
 * Construct the Smithery URL for a skill
 */
function getSkillUrl(namespace: string, slug: string): string {
	return `https://smithery.ai/skills/${namespace}/${slug}`
}

/**
 * Format skill for display in autocomplete list
 */
function formatSkillDisplay(skill: SkillListResponse): string {
	const displayName = skill.displayName || `${skill.namespace}/${skill.slug}`
	const stats =
		skill.externalStars && skill.externalStars > 0
			? `★ ${skill.externalStars.toLocaleString()}`
			: ""
	const qualifiedName = `${skill.namespace}/${skill.slug}`
	const statsDisplay = stats ? ` • ${stats}` : ""

	return `${displayName}${statsDisplay} • ${chalk.dim(qualifiedName)}`
}

/**
 * Interactive skill search and browsing
 * @param initialQuery - Initial search query (optional)
 * @param options - Search options (dump mode, limit)
 * @returns Promise<SkillListResponse | null> - Selected skill or null if cancelled
 */
export async function searchSkills(
	initialQuery?: string,
	options: SearchOptions = {},
): Promise<SkillListResponse | null> {
	const { json = false, limit = 10, page = 1, namespace } = options

	// In json mode, require a query (unless filtering by namespace)
	if (json && !initialQuery && !namespace) {
		console.error(
			chalk.red("Error: --json requires a search query or --namespace filter"),
		)
		process.exit(1)
	}

	let searchTerm =
		json || namespace ? (initialQuery ?? "") : await getSearchTerm(initialQuery)

	try {
		while (true) {
			// Skills search is a public endpoint, no authentication required
			const client = new Smithery({ apiKey: "" })

			// Build query params
			const queryParams: {
				q?: string
				pageSize: number
				page?: number
				namespace?: string
			} = {
				pageSize: limit,
				page,
			}
			if (searchTerm) {
				queryParams.q = searchTerm
			}
			if (namespace) {
				queryParams.namespace = namespace
			}

			// JSON mode: fetch and output JSON without spinners
			if (json) {
				const response = await client.skills.list(queryParams)
				// Filter out internal fields from JSON output
				const cleanedSkills = response.skills.map((skill) => {
					const {
						vector,
						$dist,
						score,
						gitUrl,
						totalActivations,
						uniqueUsers,
						externalStars,
						...rest
					} = skill as SkillListResponse & {
						vector?: unknown
						$dist?: unknown
						score?: unknown
					}
					return {
						...rest,
						stars: externalStars,
						url: getSkillUrl(skill.namespace, skill.slug),
					}
				})
				console.log(JSON.stringify(cleanedSkills, null, 2))
				return null
			}

			const ora = (await import("ora")).default
			const searchMsg = namespace
				? `Searching in ${namespace}${searchTerm ? ` for "${searchTerm}"` : ""}...`
				: `Searching for "${searchTerm}"...`
			const spinner = ora(searchMsg).start()

			const response = await client.skills.list(queryParams)

			const skills = response.skills

			if (skills.length === 0) {
				spinner.fail(`No skills found for "${searchTerm}"`)
				return null
			}

			spinner.succeed(
				`☀ ${skills.length < limit ? `Found ${skills.length} result${skills.length === 1 ? "" : "s"}:` : `Showing top ${skills.length} results:`}`,
			)
			console.log(
				chalk.dim(
					`${chalk.cyan("→ View more")} at smithery.ai/skills?q=${searchTerm.replace(/\s+/g, "+")}`,
				),
			)
			console.log()

			// Show interactive selection
			const inquirer = (await import("inquirer")).default
			const autocompletePrompt = (await import("inquirer-autocomplete-prompt"))
				.default
			inquirer.registerPrompt("autocomplete", autocompletePrompt)

			const { selectedSkill } = await inquirer.prompt([
				{
					type: "autocomplete",
					name: "selectedSkill",
					message: "Select skill for details (or search again):",
					source: (_: unknown, input: string) => {
						const options = [
							{ name: chalk.dim("← Search again"), value: "__SEARCH_AGAIN__" },
							{ name: chalk.dim("Exit"), value: "__EXIT__" },
						]

						const filtered = skills
							.filter((s) => {
								const searchStr = (input || "").toLowerCase()
								return (
									s.displayName?.toLowerCase().includes(searchStr) ||
									s.slug.toLowerCase().includes(searchStr) ||
									s.namespace.toLowerCase().includes(searchStr) ||
									s.description?.toLowerCase().includes(searchStr)
								)
							})
							.map((s) => ({
								name: formatSkillDisplay(s),
								value: s.id,
							}))

						return Promise.resolve([...options, ...filtered])
					},
				},
			])

			if (selectedSkill === "__EXIT__") {
				return null
			} else if (selectedSkill === "__SEARCH_AGAIN__") {
				searchTerm = await getSearchTerm()
				continue
			}

			// Show detailed view of selected skill
			console.log()
			const selectedSkillData = skills.find((s) => s.id === selectedSkill)
			if (selectedSkillData) {
				const displayName =
					selectedSkillData.displayName ||
					`${selectedSkillData.namespace}/${selectedSkillData.slug}`
				console.log(`${chalk.bold.cyan(displayName)}`)
				console.log(
					`${chalk.dim("Qualified name:")} ${selectedSkillData.namespace}/${selectedSkillData.slug}`,
				)
				if (selectedSkillData.description) {
					console.log(
						`${chalk.dim("Description:")} ${selectedSkillData.description}`,
					)
				}
				if (
					selectedSkillData.categories &&
					selectedSkillData.categories.length > 0
				) {
					console.log(
						`${chalk.dim("Categories:")} ${selectedSkillData.categories.join(", ")}`,
					)
				}
				if (selectedSkillData.externalStars) {
					console.log(
						`${chalk.dim("Stars:")} ${selectedSkillData.externalStars.toLocaleString()}`,
					)
				}
				console.log()

				// Show install command using Vercel Labs skills CLI
				// https://github.com/vercel-labs/skills
				const installUrl = getSkillUrl(
					selectedSkillData.namespace,
					selectedSkillData.slug,
				)
				console.log(chalk.bold("To install this skill, run:"))
				console.log()
				console.log(chalk.cyan(`  npx skills add ${installUrl}`))
				console.log()

				// Ask what to do next
				const { action } = await inquirer.prompt([
					{
						type: "list",
						name: "action",
						message: "What would you like to do?",
						choices: [
							{ name: "↓ Install", value: "install" },
							{ name: "← Back to skill list", value: "back" },
							{ name: "← Search again", value: "search" },
							{ name: "Exit", value: "exit" },
						],
					},
				])

				if (action === "install") {
					console.log()
					console.log(chalk.cyan(`Running: npx skills add ${installUrl}`))
					console.log()
					const { execSync } = await import("node:child_process")
					execSync(`npx skills add ${installUrl}`, { stdio: "inherit" })
					return null
				} else if (action === "back") {
					console.log()
				} else if (action === "search") {
					searchTerm = await getSearchTerm()
				} else {
					return null // Exit
				}
			}
		}
	} catch (error) {
		console.error(
			chalk.red("Error searching skills:"),
			error instanceof Error ? error.message : String(error),
		)
		process.exit(1)
	}
}
