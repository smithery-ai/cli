import { fatal } from "../../lib/cli-error"
import { createSmitheryClient } from "../../lib/smithery-client"
import { isJsonMode, outputDetail } from "../../utils/output"

export async function createToken(options: { policy?: string }) {
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

	try {
		const client = await createSmitheryClient()
		const result = await client.tokens.create(policy ? { policy } : undefined)

		outputDetail({
			data: {
				token: result.token,
				expiresAt: result.expiresAt,
			},
			json: isJson,
			tip: "Set SMITHERY_API_KEY=<token> to use this token.",
		})
	} catch (error) {
		fatal("Failed to create token", error)
	}
}
