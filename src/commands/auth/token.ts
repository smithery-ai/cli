import { fatal } from "../../lib/cli-error"
import { createSmitheryClient } from "../../lib/smithery-client"
import { isJsonMode, outputDetail } from "../../utils/output"

export async function createToken(options: {
	policy?: string
	prompt?: string
}) {
	const isJson = isJsonMode()

	let policy: Array<Record<string, unknown>> | undefined
	if (options.policy) {
		try {
			const parsed = JSON.parse(options.policy)
			policy = Array.isArray(parsed) ? parsed : [parsed]
		} catch (e) {
			fatal("Invalid policy JSON", e)
		}
	}

	const body: Record<string, unknown> = {}
	if (policy) body.policy = policy
	if (options.prompt) body.prompt = options.prompt

	if (!body.policy && !body.prompt) {
		fatal(
			"At least one of --policy or --prompt is required to mint a scoped token.",
		)
	}

	try {
		const client = await createSmitheryClient()
		const result = await client.tokens.create(body)

		const data: Record<string, unknown> = {
			token: result.token,
			expiresAt: result.expiresAt,
		}
		if ("generatedPolicy" in result && result.generatedPolicy) {
			data.generatedPolicy = result.generatedPolicy
		}

		outputDetail({
			data,
			json: isJson,
			tip: "Set SMITHERY_API_KEY=<token> to use this token.",
		})
	} catch (error) {
		fatal("Failed to create token", error)
	}
}
