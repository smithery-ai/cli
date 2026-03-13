import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { toFile } from "@smithery/api/uploads"
import { zipSync } from "fflate"
import pc from "picocolors"
import yoctoSpinner from "yocto-spinner"
import { fatal } from "../../lib/cli-error"
import { resolveNamespace } from "../../lib/namespace.js"
import { createSmitheryClientSync } from "../../lib/smithery-client"
import { ensureApiKey } from "../../utils/runtime.js"

interface UploadOptions {
	name?: string
}

/** Recursively collect all file paths in a directory. */
function collectFiles(
	dir: string,
	base: string = dir,
): Map<string, Uint8Array> {
	const files = new Map<string, Uint8Array>()
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name)
		if (entry.isDirectory()) {
			// Skip hidden dirs and common non-skill dirs
			if (entry.name.startsWith(".") || entry.name === "node_modules") continue
			for (const [k, v] of collectFiles(fullPath, base)) {
				files.set(k, v)
			}
		} else if (entry.isFile()) {
			const relPath = relative(base, fullPath)
			files.set(relPath, new Uint8Array(readFileSync(fullPath)))
		}
	}
	return files
}

/** Parse the `name` field from SKILL.md frontmatter. */
function parseSkillName(skillMdContent: string): string | null {
	const match = skillMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
	if (!match) return null
	const nameMatch = match[1].match(/^name:\s*(.+)$/m)
	return nameMatch ? nameMatch[1].trim() : null
}

export async function uploadSkill(
	directory: string = ".",
	options: UploadOptions = {},
) {
	// Verify the directory exists and contains SKILL.md
	const dir = join(process.cwd(), directory)
	try {
		statSync(dir)
	} catch {
		fatal(`Directory not found: ${dir}`)
	}

	const skillMdPath = join(dir, "SKILL.md")
	let skillMdContent: string
	try {
		skillMdContent = readFileSync(skillMdPath, "utf-8")
	} catch {
		fatal(`SKILL.md not found in ${dir}. A skill must contain a SKILL.md file.`)
	}

	// Determine slug from --name or SKILL.md frontmatter
	const slug = options.name ?? parseSkillName(skillMdContent)
	if (!slug) {
		fatal(
			"Could not determine skill name. Either provide --name or add a 'name' field to SKILL.md frontmatter.",
		)
	}

	// Authenticate
	const apiKey = await ensureApiKey()
	const client = createSmitheryClientSync(apiKey)

	// Resolve namespace
	const namespace = await resolveNamespace(client)

	// Collect files and create ZIP
	const spinner = yoctoSpinner({ text: "Creating archive..." }).start()

	const files = collectFiles(dir)
	const zipInput: Record<string, Uint8Array> = {}
	for (const [path, content] of files) {
		zipInput[path] = content
	}

	const zipData = zipSync(zipInput)
	const archive = await toFile(zipData, "archive.zip", {
		type: "application/zip",
	})

	spinner.text = "Uploading skill..."

	try {
		const result = await client.skills.upload(slug, {
			namespace,
			archive,
		})

		spinner.success(
			result.updatedAt
				? `Updated skill ${pc.cyan(`${namespace}/${slug}`)}`
				: `Created skill ${pc.cyan(`${namespace}/${slug}`)}`,
		)
		console.log(
			pc.dim(`  View at: https://smithery.ai/skills/${namespace}/${slug}`),
		)
	} catch (error) {
		spinner.error("Upload failed")
		fatal("Failed to upload skill", error)
	}
}
