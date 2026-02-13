import { Smithery } from "@smithery/api/client.js"
import { getApiKey } from "../../utils/smithery-settings"

const SKILLS_SCOPE_POLICY: Array<{
	resources: Array<"skills">
	operations: Array<"read" | "write">
	ttl: number
}> = [
	{
		resources: ["skills"],
		operations: ["read", "write"],
		ttl: 3600,
	},
]

export interface ParsedSkillIdentifier {
	namespace: string
	slug: string
}

export function parseSkillIdentifier(
	identifier: string,
): ParsedSkillIdentifier {
	const match = identifier.match(/^([^/]+)\/(.+)$/)
	if (!match) {
		throw new Error(
			`Invalid skill identifier: ${identifier}. Use format namespace/slug.`,
		)
	}
	return { namespace: match[1], slug: match[2] }
}

export function getSkillUrl(namespace: string, slug: string): string {
	return `https://smithery.ai/skills/${namespace}/${slug}`
}

export function createPublicSkillsClient(): Smithery {
	return new Smithery({ apiKey: "" })
}

export async function createAuthenticatedSkillsClient(): Promise<Smithery | null> {
	const rootApiKey = await getApiKey()
	if (!rootApiKey) return null

	try {
		const rootClient = new Smithery({ apiKey: rootApiKey })
		const token = await rootClient.tokens.create({
			policy: SKILLS_SCOPE_POLICY,
		})
		return new Smithery({ apiKey: token.token })
	} catch {
		// Fall back to root key if minting fails.
		return new Smithery({ apiKey: rootApiKey })
	}
}
