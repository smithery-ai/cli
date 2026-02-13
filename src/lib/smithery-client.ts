import { Smithery } from "@smithery/api"
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

/** Create an unauthenticated client (for public endpoints like skills search). */
export function createPublicClient(): Smithery {
	return new Smithery({ apiKey: "" })
}

/** Create a scoped client by minting a restricted token. Falls back to root key. */
export async function createScopedClient(
	policy: Array<Record<string, unknown>>,
): Promise<Smithery | null> {
	const rootApiKey = await getApiKey()
	if (!rootApiKey) return null

	try {
		const rootClient = new Smithery({ apiKey: rootApiKey })
		const token = await rootClient.tokens.create({ policy })
		return new Smithery({ apiKey: token.token })
	} catch {
		return new Smithery({ apiKey: rootApiKey })
	}
}
