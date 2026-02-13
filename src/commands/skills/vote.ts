import { fatal } from "../../lib/cli-error"
import {
	parseSkillIdentifierOrDie,
	requireAuthenticatedSkillsClient,
} from "./shared.js"

export async function voteSkill(
	skillIdentifier: string,
	vote: "up" | "down",
): Promise<void> {
	if (!skillIdentifier) {
		fatal("Skill identifier is required\nUsage: smithery skills vote <namespace/slug> --up|--down")
	}

	const { namespace, slug } = parseSkillIdentifierOrDie(skillIdentifier)
	const client = await requireAuthenticatedSkillsClient()

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
		fatal("Failed to vote on skill", error)
	}
}
