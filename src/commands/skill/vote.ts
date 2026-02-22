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
		fatal(
			"Skill identifier is required\nUsage: smithery skills vote <namespace/slug> --up|--down",
		)
	}

	const { namespace, slug } = parseSkillIdentifierOrDie(skillIdentifier)
	const client = await requireAuthenticatedSkillsClient()

	const yoctoSpinner = (await import("yocto-spinner")).default
	const voteLabel = vote === "up" ? "Upvoting" : "Downvoting"
	const spinner = yoctoSpinner({ text: `${voteLabel} skill...` }).start()

	try {
		await client.skills.votes.create(slug, {
			namespace,
			vote,
		})

		spinner.success(`Skill ${vote}voted`)
	} catch (error) {
		spinner.error("Failed to vote on skill")
		fatal("Failed to vote on skill", error)
	}
}
