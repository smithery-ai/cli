import { spawn } from "node:child_process"
import chalk from "chalk"
import { createSmitheryClient } from "../../lib/smithery-client"
import { searchSkills } from "./search"

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
 * Hands off to the skills CLI (skills.sh) for interactive input and logging
 * @param skillUrl - The skill URL to install
 */
async function executeSkillInstall(skillUrl: string): Promise<void> {
  console.log(
    chalk.cyan("*"),
    `Using skills CLI (skills.sh) to install from ${chalk.bold(skillUrl)}`,
  )
  console.log()

  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["skills@latest", "add", skillUrl], {
      stdio: "inherit",
      env: { ...process.env },
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`skills CLI exited with code ${code}`))
      }
    })

    child.on("error", (error) => {
      console.error(chalk.red(`Failed to run skills CLI: ${error.message}`))
      reject(error)
    })
  })
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
