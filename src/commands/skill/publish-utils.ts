import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { zipSync } from "fflate"

/** Recursively collect all file paths in a directory. */
export function collectFiles(
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
export function parseSkillName(skillMdContent: string): string | null {
	const match = skillMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
	if (!match) return null
	const nameMatch = match[1].match(/^name:\s*(.+)$/m)
	return nameMatch ? nameMatch[1].trim() : null
}

/** Create a ZIP archive from a directory's contents. */
export function createArchiveFromDirectory(dir: string): Uint8Array {
	const files = collectFiles(dir)
	const zipInput: Record<string, Uint8Array> = {}
	for (const [path, content] of files) {
		zipInput[path] = content
	}
	return zipSync(zipInput)
}
