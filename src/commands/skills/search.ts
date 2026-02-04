import chalk from "chalk"
import type { SkillListResponse } from "@smithery/api/resources/skills"
import { createSmitheryClient } from "../../lib/smithery-client"

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
 * Format skill for display in autocomplete list
 */
function formatSkillDisplay(skill: SkillListResponse): string {
	const displayName = skill.displayName || `${skill.namespace}/${skill.slug}`
	const stats =
		skill.totalActivations && skill.totalActivations > 0
			? `${skill.totalActivations.toLocaleString()} activations`
			: skill.uniqueUsers && skill.uniqueUsers > 0
				? `${skill.uniqueUsers.toLocaleString()} users`
				: ""
	const qualifiedName = `@${skill.namespace}/${skill.slug}`
	const statsDisplay = stats ? ` • ${stats}` : ""

	return `${displayName}${statsDisplay} • ${chalk.dim(qualifiedName)}`
}

/**
 * Interactive skill search and browsing
 * @param initialQuery - Initial search query (optional)
 * @returns Promise<SkillListResponse | null> - Selected skill or null if cancelled
 */
export async function searchSkills(
	initialQuery?: string,
): Promise<SkillListResponse | null> {
	let searchTerm = await getSearchTerm(initialQuery)

	try {
		while (true) {
			const ora = (await import("ora")).default
			const spinner = ora(`Searching for "${searchTerm}"...`).start()

			const client = await createSmitheryClient()
			const response = await client.skills.list({
				q: searchTerm,
				pageSize: 10,
			})

			const skills = response.skills

			if (skills.length === 0) {
				spinner.fail(`No skills found for "${searchTerm}"`)
				return null
			}

			spinner.succeed(
				`☀ ${skills.length < 10 ? `Found ${skills.length} result${skills.length === 1 ? "" : "s"}:` : `Showing top ${skills.length} results:`}`,
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
					`${chalk.dim("Qualified name:")} @${selectedSkillData.namespace}/${selectedSkillData.slug}`,
				)
				if (selectedSkillData.description) {
					console.log(
						`${chalk.dim("Description:")} ${selectedSkillData.description}`,
					)
				}
				if (selectedSkillData.categories && selectedSkillData.categories.length > 0) {
					console.log(
						`${chalk.dim("Categories:")} ${selectedSkillData.categories.join(", ")}`,
					)
				}
				if (selectedSkillData.totalActivations) {
					console.log(
						`${chalk.dim("Activations:")} ${selectedSkillData.totalActivations.toLocaleString()}`,
					)
				}
				if (selectedSkillData.uniqueUsers) {
					console.log(
						`${chalk.dim("Users:")} ${selectedSkillData.uniqueUsers.toLocaleString()}`,
					)
				}
				console.log()
				console.log(
					chalk.dim(
						`Use 'smithery skills install @${selectedSkillData.namespace}/${selectedSkillData.slug}' to install`,
					),
				)

				// Ask what to do next
				const { action } = await inquirer.prompt([
					{
						type: "list",
						name: "action",
						message: "What would you like to do?",
						choices: [
							{ name: "Install this skill", value: "install" },
							{ name: "← Back to skill list", value: "back" },
							{ name: "← Search again", value: "search" },
							{ name: "Exit", value: "exit" },
						],
					},
				])

				if (action === "install") {
					return selectedSkillData
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
