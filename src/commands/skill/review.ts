import type { ReviewItem } from "@smithery/api/resources/skills/reviews.js"
import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
import { isJsonMode } from "../../utils/output"
import {
	createPublicSkillsClient,
	parseSkillIdentifierOrDie,
	requireAuthenticatedSkillsClient,
} from "./shared.js"

function formatReview(review: ReviewItem, index?: number): string {
	const prefix = index !== undefined ? `${index + 1}. ` : ""
	const agent = review.agentModel
		? pc.dim(` (${review.agentModel})`)
		: review.agentClient
			? pc.dim(` (${review.agentClient})`)
			: ""
	const date = new Date(review.createdAt).toLocaleDateString()
	const votes =
		review.upvotes > 0 || review.downvotes > 0
			? pc.dim(` [+${review.upvotes}/-${review.downvotes}]`)
			: ""
	const id = pc.dim(` id:${review.id}`)

	let output = `${prefix}${pc.cyan("Review")}${agent}${votes}${id} ${pc.dim(`- ${date}`)}`
	if (review.review) {
		output += `\n   ${review.review}`
	}
	return output
}

export interface ListReviewsOptions {
	limit?: number
	page?: number
}

export async function listReviews(
	skillIdentifier: string,
	options: ListReviewsOptions = {},
): Promise<void> {
	const { limit = 10, page = 1 } = options
	const json = isJsonMode()

	if (!skillIdentifier) {
		fatal(
			"Skill identifier is required\nUsage: smithery skills reviews <namespace/slug>",
		)
	}

	const { namespace, slug } = parseSkillIdentifierOrDie(skillIdentifier)

	try {
		const client = createPublicSkillsClient()
		const reviewsPage = await client.skills.reviews.list(slug, {
			namespace,
			page,
			limit,
		})

		const reviews = reviewsPage.reviews
		const pagination = reviewsPage.pagination

		if (json) {
			console.log(
				JSON.stringify({
					reviews: reviews.map((r) => ({
						id: r.id,
						review: r.review,
						agentModel: r.agentModel,
						upvotes: r.upvotes,
						downvotes: r.downvotes,
						createdAt: r.createdAt,
					})),
					pagination,
				}),
			)
			return
		}

		if (reviews.length === 0) {
			console.log(pc.yellow(`No reviews yet for ${skillIdentifier}`))
			console.log(
				pc.dim(
					`Be the first to review: smithery skills review ${skillIdentifier}`,
				),
			)
			return
		}

		const totalCount = pagination.totalCount ?? reviews.length

		console.log(
			pc.bold(
				`Reviews for ${pc.cyan(skillIdentifier)} (${totalCount} review${totalCount === 1 ? "" : "s"})`,
			),
		)
		console.log()

		for (let i = 0; i < reviews.length; i++) {
			console.log(formatReview(reviews[i], i))
			console.log()
		}

		const totalPages = pagination.totalPages ?? 1
		const currentPage = pagination.currentPage ?? page
		if (totalPages > 1) {
			console.log(
				pc.dim(`Page ${currentPage} of ${totalPages} (${totalCount} total)`),
			)
			if (currentPage < totalPages) {
				console.log(
					pc.dim(
						`View more: smithery skills reviews ${skillIdentifier} --page ${currentPage + 1}`,
					),
				)
			}
		}
	} catch (error) {
		fatal("Error fetching reviews", error)
	}
}

export interface SubmitReviewOptions {
	review?: string
	model?: string
	vote: "up" | "down"
}

export async function submitReview(
	skillIdentifier: string,
	options: SubmitReviewOptions,
): Promise<void> {
	if (!skillIdentifier) {
		fatal(
			"Skill identifier is required\nUsage: smithery skills review <namespace/slug>",
		)
	}

	const { namespace, slug } = parseSkillIdentifierOrDie(skillIdentifier)
	const client = await requireAuthenticatedSkillsClient()

	const reviewText = options.review?.trim()

	if (!reviewText || reviewText.length === 0) {
		fatal(
			"Review text is required\nUsage: smithery skills review create <skill> -b <text>",
		)
	}

	if (reviewText.length > 1000) {
		fatal(`Review is too long (${reviewText.length}/1000 characters)`)
	}

	const yoctoSpinner = (await import("yocto-spinner")).default

	try {
		const spinner = yoctoSpinner({ text: "Submitting review..." }).start()
		const result = await client.skills.reviews.create(slug, {
			namespace,
			review: reviewText,
			agentModel: options.model,
			vote: options.vote,
		})
		spinner.success(`Review submitted and skill ${options.vote}voted`)

		console.log()
		console.log(pc.cyan("Your review:"))
		if (result.review) {
			console.log(result.review)
		}
		console.log()
		console.log(
			pc.dim(
				`View all reviews: smithery skills review list ${skillIdentifier}`,
			),
		)
	} catch (error) {
		fatal("Failed to submit review", error)
	}
}

export async function deleteReview(skillIdentifier: string): Promise<void> {
	if (!skillIdentifier) {
		fatal(
			"Skill identifier is required\nUsage: smithery skills review --delete <namespace/slug>",
		)
	}

	const { namespace, slug } = parseSkillIdentifierOrDie(skillIdentifier)
	const client = await requireAuthenticatedSkillsClient()

	const yoctoSpinner = (await import("yocto-spinner")).default
	const spinner = yoctoSpinner({ text: "Deleting review..." }).start()

	try {
		await client.skills.reviews.delete(slug, { namespace })
		spinner.success("Review deleted")
	} catch (error) {
		spinner.error("Failed to delete review")
		fatal("Failed to delete review", error)
	}
}

export async function voteReview(
	skillIdentifier: string,
	reviewId: string,
	vote: "up" | "down",
): Promise<void> {
	if (!skillIdentifier) {
		fatal(
			"Skill identifier is required\nUsage: smithery skills vote <namespace/slug> <review-id> --up|--down",
		)
	}

	if (!reviewId) {
		fatal("Review ID is required")
	}

	const { namespace, slug } = parseSkillIdentifierOrDie(skillIdentifier)
	const client = await requireAuthenticatedSkillsClient()

	const yoctoSpinner = (await import("yocto-spinner")).default
	const voteLabel = vote === "up" ? "Upvoting" : "Downvoting"
	const spinner = yoctoSpinner({ text: `${voteLabel} review...` }).start()

	try {
		await client.skills.reviews.vote(reviewId, {
			namespace,
			slug,
			vote,
		})

		spinner.success(`Review ${vote}voted`)
	} catch (error) {
		spinner.error("Failed to vote")
		fatal("Failed to vote on review", error)
	}
}
