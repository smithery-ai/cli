import { Smithery } from "@smithery/api/client.js"
import { getApiKey } from "../utils/smithery-settings"

/**
 * Creates a Smithery client with consistent configuration.
 *
 * Base URL resolution order:
 * 1. SMITHERY_BASE_URL env var (SDK default)
 * 2. SDK default: https://api.smithery.ai
 *
 * API key resolution order:
 * 1. Provided apiKey parameter
 * 2. SMITHERY_BEARER_AUTH env var
 * 3. Stored API key from settings
 */
export async function createSmitheryClient(apiKey?: string): Promise<Smithery> {
	const key = apiKey ?? (await getApiKey())
	if (!key) {
		throw new Error("No API key found. Run 'smithery login' to authenticate.")
	}
	return new Smithery({ apiKey: key })
}

/**
 * Creates a Smithery client synchronously (when you already have the API key).
 */
export function createSmitheryClientSync(apiKey: string): Smithery {
	return new Smithery({ apiKey })
}
