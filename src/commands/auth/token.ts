import { Smithery } from "@smithery/api/client.js"
import chalk from "chalk"
import { outputDetail } from "../../utils/output"
import { getApiKey } from "../../utils/smithery-settings"

export async function createToken(options: {
	policy?: string
	json?: boolean
}) {
	const isJson = options.json ?? false
	const apiKey = await getApiKey()
	if (!apiKey) {
		console.error(chalk.red("Not logged in. Run 'smithery auth login' first."))
		process.exit(1)
	}

	let policy: Array<Record<string, unknown>> | undefined
	if (options.policy) {
		try {
			const parsed = JSON.parse(options.policy)
			policy = Array.isArray(parsed) ? parsed : [parsed]
		} catch (e) {
			console.error(
				chalk.red(
					`Invalid policy JSON: ${e instanceof Error ? e.message : String(e)}`,
				),
			)
			process.exit(1)
		}
	}

	try {
		const client = new Smithery({ apiKey })
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
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(chalk.red(`Failed to create token: ${errorMessage}`))
		process.exit(1)
	}
}
