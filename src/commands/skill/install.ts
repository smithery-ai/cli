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
	const globalFlag = options.global ? " -g" : ""
	const yesFlag = options.yes ? " -y" : ""

	if (!agent) {
		const command = `npx -y skills add ${skillUrl}${globalFlag}${yesFlag}`
		console.log()
		console.log(pc.cyan(`Running: ${command}`))
		console.log()
		execSync(command, { stdio: "inherit" })
		return
	}

	const command = `npx -y skills add ${skillUrl} --agent ${agent}${globalFlag} -y`
	console.log()
	console.log(pc.cyan(`Running: ${command}`))
	console.log()
	execSync(command, { stdio: "inherit" })
}
