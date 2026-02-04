import { Smithery } from "@smithery/api/client.js"
import chalk from "chalk"

/**
 * Construct the Smithery URL for a skill
 */
function getSkillUrl(namespace: string, slug: string): string {
	return `https://smithery.ai/skills/${namespace}/${slug}`
}

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

	// Parse namespace/slug format
	const match = identifier.match(/^([^/]+)\/(.+)$/)
	if (!match) {
		throw new Error(
			`Invalid skill identifier: ${identifier}. Use format namespace/slug or a URL.`,
		)
	}

	const [, namespace, slug] = match

	// Skills lookup is a public endpoint, no authentication required
	const client = new Smithery({ apiKey: "" })
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
 * @param skillIdentifier - Skill identifier (namespace/slug or URL) - required
 * @param agent - Target agent for installation - required
 * @param options - Install options (global flag)
 */
export async function installSkill(
	skillIdentifier: string,
	agent: string,
	options: InstallOptions = {},
): Promise<void> {
	if (!skillIdentifier) {
		console.error(chalk.red("Error: Skill identifier is required"))
		console.error(
			chalk.dim(
				"Usage: smithery skills install <namespace/slug> --agent <agent>",
			),
		)
		console.error(
			chalk.dim("       smithery skills install <url> --agent <agent>"),
		)
		process.exit(1)
	}

	if (!agent) {
		console.error(chalk.red("Error: Agent is required"))
		console.error(
			chalk.dim("Usage: smithery skills install <skill> --agent <agent>"),
		)
		process.exit(1)
	}

	let skillUrl: string

	try {
		skillUrl = await resolveSkillUrl(skillIdentifier)
	} catch (error) {
		console.error(
			chalk.red(error instanceof Error ? error.message : String(error)),
		)
		process.exit(1)
	}

	const globalFlag = options.global ? " -g" : ""
	const command = `npx skills add ${skillUrl} --agent ${agent}${globalFlag} -y`

	console.log()
	console.log(chalk.cyan(`Running: ${command}`))
	console.log()

	const { execSync } = await import("node:child_process")
	execSync(command, { stdio: "inherit" })
}
