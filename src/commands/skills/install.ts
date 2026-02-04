import { exec } from "node:child_process"
import { promisify } from "node:util"
import chalk from "chalk"
import { createSmitheryClient } from "../../lib/smithery-client"
import { searchSkills } from "./search"

const execAsync = promisify(exec)

/**
 * Resolve a skill identifier to a URL for installation
 * @param identifier - Skill identifier (URL or @namespace/slug format)
 * @returns Promise<string> - The skill URL
 */
async function resolveSkillUrl(identifier: string): Promise<string> {
	// If already a URL, use directly
	if (identifier.startsWith("http")) {
		return identifier
	}

	// Parse @namespace/slug format
	const match = identifier.match(/^@?([^/]+)\/(.+)$/)
	if (!match) {
		throw new Error(
			`Invalid skill identifier: ${identifier}. Use format @namespace/slug or a URL.`,
		)
	}

	const [, namespace, slug] = match

	// Look up the skill to get its gitUrl
	const client = await createSmitheryClient()
	const response = await client.skills.list({
		namespace,
		slug,
		pageSize: 1,
	})

	if (response.skills.length === 0) {
		throw new Error(`Skill not found: ${identifier}`)
	}

	const skill = response.skills[0]

	// Use gitUrl if available, otherwise construct smithery URL
	if (skill.gitUrl) {
		return skill.gitUrl
	}

	return `https://smithery.ai/skill/@${namespace}/${slug}`
}

/**
 * Execute npx skills add to install a skill
 * @param skillUrl - The skill URL to install
 */
async function executeSkillInstall(skillUrl: string): Promise<void> {
	const ora = (await import("ora")).default
	const spinner = ora(`Installing skill from ${skillUrl}...`).start()

	try {
		const command = `npx skills add "${skillUrl}"`

		const { stdout, stderr } = await execAsync(command, {
			env: { ...process.env },
			timeout: 120000, // 2 minute timeout
		})

		spinner.succeed("Skill installed successfully")

		if (stdout) {
			console.log(stdout)
		}
		if (stderr && !stderr.includes("npm warn")) {
			console.error(chalk.yellow(stderr))
		}
	} catch (error) {
		spinner.fail("Failed to install skill")
		if (error instanceof Error) {
			console.error(chalk.red(error.message))
		}
		throw error
	}
}

/**
 * Install a skill by running npx skills add
 * @param skillIdentifier - Optional skill identifier (@namespace/slug or URL)
 */
export async function installSkill(skillIdentifier?: string): Promise<void> {
	let skillUrl: string

	if (skillIdentifier) {
		// Direct identifier provided - resolve and install
		try {
			skillUrl = await resolveSkillUrl(skillIdentifier)
		} catch (error) {
			console.error(
				chalk.red(error instanceof Error ? error.message : String(error)),
			)
			process.exit(1)
		}
	} else {
		// No identifier - use interactive search
		console.log(chalk.cyan("*"), "No skill specified, starting search...")
		console.log()

		const selectedSkill = await searchSkills()

		if (!selectedSkill) {
			console.log(chalk.dim("Installation cancelled."))
			return
		}

		// Get the URL from the selected skill
		if (selectedSkill.gitUrl) {
			skillUrl = selectedSkill.gitUrl
		} else {
			skillUrl = `https://smithery.ai/skill/@${selectedSkill.namespace}/${selectedSkill.slug}`
		}
	}

	console.log()
	await executeSkillInstall(skillUrl)
}
