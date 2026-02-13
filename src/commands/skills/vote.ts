import chalk from "chalk"
import {
	createAuthenticatedSkillsClient,
	parseSkillIdentifier,
} from "./shared.js"

/**
 * Vote on a skill (upvote or downvote)
 * @param skillIdentifier - Skill identifier (namespace/slug)
 * @param vote - 'up' or 'down'
 */
export async function voteSkill(
	skillIdentifier: string,
	vote: "up" | "down",
): Promise<void> {
	if (!skillIdentifier) {
		console.error(chalk.red("Error: Skill identifier is required"))
		console.error(
			chalk.dim("Usage: smithery skills vote <namespace/slug> --up|--down"),
		)
		process.exit(1)
	}

	let namespace: string
	let slug: string
	try {
		const parsed = parseSkillIdentifier(skillIdentifier)
		namespace = parsed.namespace
		slug = parsed.slug
	} catch (error) {
		console.error(
			chalk.red(error instanceof Error ? error.message : String(error)),
		)
		process.exit(1)
	}

	// Voting requires authentication
	const client = await createAuthenticatedSkillsClient()
	if (!client) {
		console.error(chalk.red("Error: Not logged in."))
		console.error(chalk.dim("Run 'smithery login' to authenticate."))
		process.exit(1)
	}

	const ora = (await import("ora")).default
	const voteLabel = vote === "up" ? "Upvoting" : "Downvoting"
	const spinner = ora(`${voteLabel} skill...`).start()

	try {
		await client.skills.votes.create(slug, {
			namespace,
			vote,
		})

		spinner.succeed(`Skill ${vote}voted`)
	} catch (error) {
		spinner.fail("Failed to vote on skill")
		console.error(
			chalk.red(error instanceof Error ? error.message : String(error)),
		)
		process.exit(1)
	}
}
