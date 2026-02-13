import chalk from "chalk"
import {
	createPublicSkillsClient,
	getSkillUrl,
	parseSkillIdentifier,
} from "./shared.js"

/**
 * Resolve a skill identifier to a URL for installation
 * @param identifier - Skill identifier (URL or namespace/slug format)
 * @returns Promise<string> - The skill URL
 */
async function resolveSkillUrl(identifier: string): Promise<string> {
	// If already a URL, use directly
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
}

/**
 * Install a skill using the Vercel Labs skills CLI
 * https://github.com/vercel-labs/skills
 * @param skillIdentifier - Skill identifier (namespace/slug or URL)
 * @param agent - Target agent for installation, omit to be prompted interactively
 * @param options - Install options (global flag)
 */
export async function installSkill(
	skillIdentifier: string,
	agent?: string,
	options: InstallOptions = {},
): Promise<void> {
	let skillUrl: string

	try {
		skillUrl = await resolveSkillUrl(skillIdentifier)
	} catch (error) {
		console.error(
			chalk.red(error instanceof Error ? error.message : String(error)),
		)
		process.exit(1)
	}

	const { execSync } = await import("node:child_process")
	const globalFlag = options.global ? " -g" : ""

	// No agent — interactive (will prompt for agent)
	if (!agent) {
		const command = `npx -y skills add ${skillUrl}${globalFlag}`
		console.log()
		console.log(chalk.cyan(`Running: ${command}`))
		console.log()
		execSync(command, { stdio: "inherit" })
		return
	}

	// Both provided — non-interactive
	const command = `npx -y skills add ${skillUrl} --agent ${agent}${globalFlag} -y`
	console.log()
	console.log(chalk.cyan(`Running: ${command}`))
	console.log()
	execSync(command, { stdio: "inherit" })
}
