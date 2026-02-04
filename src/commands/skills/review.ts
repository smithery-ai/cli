import { Smithery } from "@smithery/api/client.js"
import type { ReviewItem } from "@smithery/api/resources/skills/reviews.js"
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
 * Format a single review for display
 */
function formatReview(review: ReviewItem, index?: number): string {
	const prefix = index !== undefined ? `${index + 1}. ` : ""
	const agent = review.agentModel
		? chalk.dim(` (${review.agentModel})`)
		: review.agentClient
			? chalk.dim(` (${review.agentClient})`)
			: ""
	const date = new Date(review.createdAt).toLocaleDateString()
	const votes =
		review.upvotes > 0 || review.downvotes > 0
			? chalk.dim(` [+${review.upvotes}/-${review.downvotes}]`)
			: ""
	const id = chalk.dim(` id:${review.id}`)

	let output = `${prefix}${chalk.cyan("Review")}${agent}${votes}${id} ${chalk.dim(`- ${date}`)}`
	if (review.review) {
		output += `\n   ${review.review}`
	}
	return output
}

export interface ListReviewsOptions {
	json?: boolean
	limit?: number
	page?: number
}

/**
 * List reviews for a skill
 * @param skillIdentifier - Skill identifier (namespace/slug)
 * @param options - List options
 */
export async function listReviews(
	skillIdentifier: string,
	options: ListReviewsOptions = {},
): Promise<void> {
	const { json = false, limit = 10, page = 1 } = options

	if (!skillIdentifier) {
		console.error(chalk.red("Error: Skill identifier is required"))
		console.error(chalk.dim("Usage: smithery skills reviews <namespace/slug>"))
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

	try {
		const client = new Smithery({ apiKey: "" })
		const reviewsPage = await client.skills.reviews.list(slug, {
			namespace,
			page,
			limit,
		})

		const reviews = reviewsPage.reviews
		const pagination = reviewsPage.pagination

		if (json) {
			console.log(
				JSON.stringify(
					{
						reviews: reviews.map((r) => ({
							id: r.id,
							review: r.review,
							agentModel: r.agentModel,
							upvotes: r.upvotes,
							downvotes: r.downvotes,
							createdAt: r.createdAt,
						})),
						pagination,
					},
					null,
					2,
				),
			)
			return
		}

		if (reviews.length === 0) {
			console.log(chalk.yellow(`No reviews yet for ${skillIdentifier}`))
			console.log(
				chalk.dim(
					`Be the first to review: smithery skills review ${skillIdentifier}`,
				),
			)
			return
		}

		const totalCount = pagination.totalCount ?? reviews.length

		// Show header
		console.log(
			chalk.bold(
				`Reviews for ${chalk.cyan(skillIdentifier)} (${totalCount} review${totalCount === 1 ? "" : "s"})`,
			),
		)
		console.log()

		// Show reviews
		for (let i = 0; i < reviews.length; i++) {
			console.log(formatReview(reviews[i], i))
			console.log()
		}

		// Pagination info
		const totalPages = pagination.totalPages ?? 1
		const currentPage = pagination.currentPage ?? page
		if (totalPages > 1) {
			console.log(
				chalk.dim(`Page ${currentPage} of ${totalPages} (${totalCount} total)`),
			)
			if (currentPage < totalPages) {
				console.log(
					chalk.dim(
						`View more: smithery skills reviews ${skillIdentifier} --page ${currentPage + 1}`,
					),
				)
			}
		}
	} catch (error) {
		console.error(
			chalk.red("Error fetching reviews:"),
			error instanceof Error ? error.message : String(error),
		)
		process.exit(1)
	}
}

export interface SubmitReviewOptions {
	review?: string
	model?: string
	vote: "up" | "down"
}

/**
 * Submit a review for a skill
 * @param skillIdentifier - Skill identifier (namespace/slug)
 * @param options - Review options (review text, model)
 */
export async function submitReview(
	skillIdentifier: string,
	options: SubmitReviewOptions,
): Promise<void> {
	if (!skillIdentifier) {
		console.error(chalk.red("Error: Skill identifier is required"))
		console.error(chalk.dim("Usage: smithery skills review <namespace/slug>"))
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

	// Reviews require authentication
	const client = await createClient()
	if (!client) {
		console.error(chalk.red("Error: Not logged in."))
		console.error(chalk.dim("Run 'smithery login' to authenticate."))
		process.exit(1)
	}

	const reviewText = options.review?.trim()

	if (!reviewText || reviewText.length === 0) {
		console.error(chalk.red("Error: Review text is required"))
		console.error(
			chalk.dim("Usage: smithery skills review create <skill> -b <text>"),
		)
		process.exit(1)
	}

	if (reviewText.length > 1000) {
		console.error(
			chalk.red(
				`Error: Review is too long (${reviewText.length}/1000 characters)`,
			),
		)
		process.exit(1)
	}

	const ora = (await import("ora")).default

	try {
		const spinner = ora("Submitting review...").start()
		const result = await client.skills.reviews.create(slug, {
			namespace,
			review: reviewText,
			agentModel: options.model,
		})
		spinner.succeed("Review submitted")

		// Vote on skill
		const voteSpinner = ora(
			`${options.vote === "up" ? "Upvoting" : "Downvoting"} skill...`,
		).start()
		await client.skills.votes.create(slug, {
			namespace,
			isPositive: options.vote === "up",
		})
		voteSpinner.succeed(`Skill ${options.vote}voted`)

		console.log()
		console.log(chalk.cyan("Your review:"))
		if (result.review) {
			console.log(result.review)
		}
		console.log()
		console.log(
			chalk.dim(
				`View all reviews: smithery skills review list ${skillIdentifier}`,
			),
		)
	} catch (error) {
		console.error(
			chalk.red(error instanceof Error ? error.message : String(error)),
		)
		process.exit(1)
	}
}

/**
 * Delete your review for a skill
 * @param skillIdentifier - Skill identifier (namespace/slug)
 */
export async function deleteReview(skillIdentifier: string): Promise<void> {
	if (!skillIdentifier) {
		console.error(chalk.red("Error: Skill identifier is required"))
		console.error(
			chalk.dim("Usage: smithery skills review --delete <namespace/slug>"),
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

	// Requires authentication
	const client = await createClient()
	if (!client) {
		console.error(chalk.red("Error: Not logged in."))
		console.error(chalk.dim("Run 'smithery login' to authenticate."))
		process.exit(1)
	}

	const ora = (await import("ora")).default
	const spinner = ora("Deleting review...").start()

	try {
		await client.skills.reviews.delete(slug, { namespace })
		spinner.succeed("Review deleted")
	} catch (error) {
		spinner.fail("Failed to delete review")
		console.error(
			chalk.red(error instanceof Error ? error.message : String(error)),
		)
		process.exit(1)
	}
}

/**
 * Vote on a review (upvote or downvote)
 * @param skillIdentifier - Skill identifier (namespace/slug)
 * @param reviewId - The review ID to vote on
 * @param vote - 'up' or 'down'
 */
export async function voteReview(
	skillIdentifier: string,
	reviewId: string,
	vote: "up" | "down",
): Promise<void> {
	if (!skillIdentifier) {
		console.error(chalk.red("Error: Skill identifier is required"))
		console.error(
			chalk.dim(
				"Usage: smithery skills vote <namespace/slug> <review-id> --up|--down",
			),
		)
		process.exit(1)
	}

	if (!reviewId) {
		console.error(chalk.red("Error: Review ID is required"))
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
	const spinner = ora(`${voteLabel} review...`).start()

	try {
		await client.skills.reviews.vote(reviewId, {
			namespace,
			slug,
			isPositive: vote === "up",
		})

		spinner.succeed(`Review ${vote}voted`)
	} catch (error) {
		spinner.fail("Failed to vote")
		console.error(
			chalk.red(error instanceof Error ? error.message : String(error)),
		)
		process.exit(1)
	}
}
