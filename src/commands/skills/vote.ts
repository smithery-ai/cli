import { Smithery } from "@smithery/api/client.js"
import chalk from "chalk"
import { getApiKey } from "../../utils/smithery-settings"

/**
 * Creates an authenticated Smithery client with skills permissions
 */
async function createClient(): Promise<Smithery | null> {
	const rootApiKey = await getApiKey()
	if (!rootApiKey) return null

	// Mint a scoped token with skills permissions
	try {
		const rootClient = new Smithery({ apiKey: rootApiKey })
		const token = await rootClient.tokens.create({
			policy: [
				{
					resources: ["skills"],
					operations: ["read", "write"],
					ttl: 3600,
				},
			],
		})
		return new Smithery({ apiKey: token.token })
	} catch {
		// Fall back to root key if minting fails
		return new Smithery({ apiKey: rootApiKey })
	}
}

/**
 * Parse a skill identifier into namespace and slug
 */
function parseSkillIdentifier(identifier: string): {
	namespace: string
	slug: string
} {
	const match = identifier.match(/^([^/]+)\/(.+)$/)
	if (!match) {
		throw new Error(
			`Invalid skill identifier: ${identifier}. Use format namespace/slug.`,
		)
	}
	return { namespace: match[1], slug: match[2] }
}

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
	const client = await createClient()
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
			isPositive: vote === "up",
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
