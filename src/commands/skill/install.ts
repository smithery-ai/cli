import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
import {
	createPublicSkillsClient,
	getSkillUrl,
	parseSkillIdentifier,
} from "./shared.js"

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

	const { execFileSync } = await import("node:child_process")

	const args: string[] = ["-y", "skills", "add", skillUrl]
	if (agent) args.push("--agent", agent)
	if (options.global) args.push("-g")
	if (options.yes) args.push("-y")
	if (options.copy) args.push("--copy")

	const command = `npx ${args.join(" ")}`
	console.log()
	console.log(pc.cyan(`Running: ${command}`))
	console.log()
	execFileSync("npx", args, { stdio: "inherit" })
}
