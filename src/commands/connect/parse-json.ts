import chalk from "chalk"

export function parseJsonObject<T extends Record<string, unknown>>(
	json: string | undefined,
	name: string,
	validateStringValues = false,
): T | undefined {
	if (!json) return undefined
	try {
		const parsed = JSON.parse(json)
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			throw new Error(`${name} must be a JSON object`)
		}
		if (validateStringValues) {
			for (const [key, value] of Object.entries(parsed)) {
				if (typeof value !== "string") {
					throw new Error(`${name} value for "${key}" must be a string`)
				}
			}
		}
		return parsed as T
	} catch (e) {
		console.error(
			chalk.red(`Invalid ${name.toLowerCase()} JSON: ${e instanceof Error ? e.message : String(e)}`),
		)
		process.exit(1)
	}
}
