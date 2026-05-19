import type { Smithery } from "@smithery/api"
import pc from "picocolors"
import { fatal } from "./cli-error"
import { createPublicClient } from "./smithery-client"

/**
 * Skill installation passthrough.
 *
 * The user-facing `smithery skill` command was removed (SMI-1682) in favor of
 * the upstream `npx skills` installer — install-count attribution is tracked
 * server-side when the skill is fetched from smithery.ai, not in this CLI.
 * The `setup` command still needs to install the Smithery CLI's own skill, so
 * this thin resolve-then-delegate helper is retained here.
 */

interface ParsedSkillIdentifier {
	namespace: string
	slug: string
}

function parseSkillIdentifier(identifier: string): ParsedSkillIdentifier {
	const match = identifier.match(/^([^/]+)\/(.+)$/)
	if (!match) {
		throw new Error(
			`Invalid skill identifier: ${identifier}. Use format namespace/slug.`,
		)
	}
	return { namespace: match[1], slug: match[2] }
}

function getSkillUrl(namespace: string, slug: string): string {
	return `https://smithery.ai/skills/${namespace}/${slug}`
}

function createPublicSkillsClient(): Smithery {
	return createPublicClient()
}

async function resolveSkillUrl(identifier: string): Promise<string> {
	if (identifier.startsWith("http")) {
		return identifier
	}

	let namespace: string
	let slug: string
	try {
		const parsed = parseSkillIdentifier(identifier)
		namespace = parsed.namespace
		slug = parsed.slug
	} catch {
		throw new Error(
			`Invalid skill identifier: ${identifier}. Use format namespace/slug or a URL.`,
		)
	}

	const client = createPublicSkillsClient()
	try {
		await client.skills.get(slug, { namespace })
		return getSkillUrl(namespace, slug)
	} catch {
		throw new Error(`Skill not found: ${identifier}`)
	}
}

export interface InstallOptions {
	global?: boolean
	yes?: boolean
	agent?: string
	copy?: boolean
}

export async function installSkill(
	skillIdentifier: string,
	agent?: string,
	options: InstallOptions = {},
): Promise<void> {
	let skillUrl: string

	try {
		skillUrl = await resolveSkillUrl(skillIdentifier)
	} catch (error) {
		fatal("Failed to resolve skill", error)
	}

	const { execSync } = await import("node:child_process")

	const flags: string[] = []
	if (agent) flags.push("--agent", agent)
	if (options.global) flags.push("-g")
	if (options.yes) flags.push("-y")
	if (options.copy) flags.push("--copy")

	const command = `npx -y skills add ${skillUrl}${flags.length ? ` ${flags.join(" ")}` : ""}`
	console.log()
	console.log(pc.cyan(`Running: ${command}`))
	console.log()
	execSync(command, { stdio: "inherit" })
}
