import type { Smithery } from "@smithery/api"
import { errorMessage, fatal } from "../../lib/cli-error"
import {
	createPublicClient,
	createScopedClient,
} from "../../lib/smithery-client"

const SKILLS_SCOPE_POLICY = [
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
	return createPublicClient()
}

export async function createAuthenticatedSkillsClient(): Promise<Smithery | null> {
	return createScopedClient(SKILLS_SCOPE_POLICY)
}

/** Parse a skill identifier or exit with an error message. */
export function parseSkillIdentifierOrDie(identifier: string): ParsedSkillIdentifier {
	try {
		return parseSkillIdentifier(identifier)
	} catch (error) {
		fatal(errorMessage(error))
	}
}

/** Get an authenticated skills client or exit if not logged in. */
export async function requireAuthenticatedSkillsClient(): Promise<Smithery> {
	const client = await createAuthenticatedSkillsClient()
	if (!client) {
		fatal("Not logged in. Run 'smithery auth login' to authenticate.")
	}
	return client
}
