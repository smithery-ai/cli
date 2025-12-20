import type { ServerConfig } from "../types/registry.js"

/**
 * Masks sensitive values in config for safe logging
 * Masks values for keys containing sensitive keywords
 */
export function maskConfig(config: ServerConfig): Record<string, unknown> {
	const masked: Record<string, unknown> = {}
	const sensitiveKeywords = [
		"key",
		"token",
		"secret",
		"password",
		"auth",
		"credential",
		"api",
	]

	for (const [key, value] of Object.entries(config)) {
		const lowerKey = key.toLowerCase()
		const isSensitive = sensitiveKeywords.some((keyword) =>
			lowerKey.includes(keyword),
		)

		if (isSensitive && typeof value === "string" && value.length > 0) {
			masked[key] = "***"
		} else {
			masked[key] = value
		}
	}

	return masked
}
