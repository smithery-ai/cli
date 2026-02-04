import chalk from "chalk"
import { getApiKey } from "../../utils/smithery-settings"

const API_BASE_URL =
	process.env.SMITHERY_BASE_URL || "https://api.smithery.ai"

/**
 * Get a skills-scoped API token
 */
async function getSkillsToken(): Promise<string | null> {
	const rootApiKey = await getApiKey()
	if (!rootApiKey) return null

	try {
		const { Smithery } = await import("@smithery/api/client.js")
		const client = new Smithery({
			apiKey: rootApiKey,
			baseURL: API_BASE_URL,
		})
		const token = await client.tokens.create({
			policy: [
				{
					resources: ["skills"],
					operations: ["read", "write"],
					ttl: 3600,
				},
			],
		})
		return token.token
	} catch {
		// Fall back to root key if minting fails
		return rootApiKey
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
 * Review item from API
 */
interface ReviewItem {
	id: string
	review: string
	agentModel: string | null
	agentClient: string | null
	upvotes: number
	downvotes: number
	createdAt: string
}

/**
 * Reviews list response from API
 */
interface ReviewsListResponse {
	data: ReviewItem[]
	pagination: {
		currentPage: number
		pageSize: number
		totalCount: number
		totalPages: number
	}
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
		const url = new URL(
			`/skills/${encodeURIComponent(namespace)}/${encodeURIComponent(slug)}/reviews`,
			API_BASE_URL,
		)
		url.searchParams.set("page", String(page))
		url.searchParams.set("limit", String(limit))

		const response = await fetch(url.toString())

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`API error: ${response.status} - ${errorText}`)
		}

		const result = (await response.json()) as ReviewsListResponse
		const reviews = result.data
		const pagination = result.pagination

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

		// Show header
		console.log(
			chalk.bold(
				`Reviews for ${chalk.cyan(skillIdentifier)} (${pagination.totalCount} review${pagination.totalCount === 1 ? "" : "s"})`,
			),
		)
		console.log()

		// Show reviews
		for (let i = 0; i < reviews.length; i++) {
			console.log(formatReview(reviews[i], i))
			console.log()
		}

		// Pagination info
		if (pagination.totalPages > 1) {
			console.log(
				chalk.dim(
					`Page ${pagination.currentPage} of ${pagination.totalPages} (${pagination.totalCount} total)`,
				),
			)
			if (pagination.currentPage < pagination.totalPages) {
				console.log(
					chalk.dim(
						`View more: smithery skills reviews ${skillIdentifier} --page ${pagination.currentPage + 1}`,
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
}

/**
 * Submit a review for a skill
 * @param skillIdentifier - Skill identifier (namespace/slug)
 * @param options - Review options (review text, model)
 */
export async function submitReview(
	skillIdentifier: string,
	options: SubmitReviewOptions = {},
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
	const apiKey = await getSkillsToken()
	if (!apiKey) {
		console.error(chalk.red("Error: Not logged in."))
		console.error(chalk.dim("Run 'smithery login' to authenticate."))
		process.exit(1)
	}

	const reviewText = options.review

	// Validate review
	if (!reviewText || reviewText.trim().length === 0) {
		console.error(chalk.red("Error: Review text is required"))
		console.error(chalk.dim("Usage: smithery skills review <skill> <text>"))
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
	const spinner = ora("Submitting review...").start()

	try {
		const url = new URL(
			`/skills/${encodeURIComponent(namespace)}/${encodeURIComponent(slug)}/reviews`,
			API_BASE_URL,
		)

		const body: { review: string; agentModel?: string } = {
			review: reviewText,
		}
		if (options.model) {
			body.agentModel = options.model
		}

		const response = await fetch(url.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`API error: ${response.status} - ${errorText}`)
		}

		const result = (await response.json()) as ReviewItem

		spinner.succeed("Review submitted!")
		console.log()

		console.log(chalk.cyan("Your review:"))
		if (result.review) {
			console.log(result.review)
		}
		console.log()
		console.log(
			chalk.dim(`View all reviews: smithery skills reviews ${skillIdentifier}`),
		)
	} catch (error) {
		spinner.fail("Failed to submit review")
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
	const apiKey = await getSkillsToken()
	if (!apiKey) {
		console.error(chalk.red("Error: Not logged in."))
		console.error(chalk.dim("Run 'smithery login' to authenticate."))
		process.exit(1)
	}

	const ora = (await import("ora")).default
	const spinner = ora("Deleting review...").start()

	try {
		const url = new URL(
			`/skills/${encodeURIComponent(namespace)}/${encodeURIComponent(slug)}/reviews`,
			API_BASE_URL,
		)

		const response = await fetch(url.toString(), {
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`API error: ${response.status} - ${errorText}`)
		}

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
	const apiKey = await getSkillsToken()
	if (!apiKey) {
		console.error(chalk.red("Error: Not logged in."))
		console.error(chalk.dim("Run 'smithery login' to authenticate."))
		process.exit(1)
	}

	const ora = (await import("ora")).default
	const voteLabel = vote === "up" ? "Upvoting" : "Downvoting"
	const spinner = ora(`${voteLabel} review...`).start()

	try {
		const url = new URL(
			`/skills/${encodeURIComponent(namespace)}/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(reviewId)}/vote`,
			API_BASE_URL,
		)

		const response = await fetch(url.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({ vote }),
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`API error: ${response.status} - ${errorText}`)
		}

		const voteEmoji = vote === "up" ? "👍" : "👎"
		spinner.succeed(`${voteEmoji} Vote recorded!`)
	} catch (error) {
		spinner.fail("Failed to vote")
		console.error(
			chalk.red(error instanceof Error ? error.message : String(error)),
		)
		process.exit(1)
	}
}
