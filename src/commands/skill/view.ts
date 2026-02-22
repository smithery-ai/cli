import pc from "picocolors"

const DEFAULT_BASE_URL = "https://smithery.ai"

/**
 * Parse a skill view identifier into namespace, slug, and optional file path.
 * Format: namespace/slug[/path...]
 */
function parseIdentifier(identifier: string) {
	const parts = identifier.split("/")
	if (parts.length < 2) {
		throw new Error(
			`Invalid identifier: ${identifier}. Use format namespace/slug or namespace/slug/path`,
		)
	}

	const [namespace, slug, ...rest] = parts
	const path = rest.length > 0 ? rest.join("/") : "SKILL.md"
	return { namespace, slug, path, hasSubpath: rest.length > 0 }
}

/**
 * Fetch the SKILL.md and extract relative file paths referenced in markdown links.
 */
async function showAvailableFiles(
	baseUrl: string,
	namespace: string,
	slug: string,
) {
	try {
		const skillUrl = `${baseUrl}/skills/${namespace}/${slug}/.well-known/skills/SKILL.md`
		const res = await fetch(skillUrl)
		if (!res.ok) return

		const content = await res.text()
		// Match markdown links with relative paths (not http/https URLs)
		const linkRegex = /\[.*?\]\((?!https?:\/\/)(.*?)\)/g
		const files = new Set<string>()
		for (const match of content.matchAll(linkRegex)) {
			files.add(match[1])
		}
		if (files.size > 0) {
			const MAX_FILES = 10
			const fileList = [...files].slice(0, MAX_FILES)
			console.error()
			console.error("Try:")
			for (const file of fileList) {
				console.error(`  smithery skills view ${namespace}/${slug}/${file}`)
			}
			if (files.size > MAX_FILES) {
				console.error(`  ...and ${files.size - MAX_FILES} more`)
			}
		}
	} catch {
		// Silently ignore - this is a best-effort hint
	}
}

/**
 * View a skill's documentation without installing it.
 * Fetches files from the .well-known endpoint on smithery.ai.
 *
 * @param identifier - namespace/slug or namespace/slug/path
 */
export async function viewSkill(identifier: string): Promise<void> {
	if (!identifier) {
		console.error(pc.red("Error: Skill identifier is required"))
		console.error(
			pc.dim("Usage: smithery skills view <namespace/slug[/path]>"),
		)
		process.exit(1)
	}

	let parsed: ReturnType<typeof parseIdentifier>
	try {
		parsed = parseIdentifier(identifier)
	} catch (error) {
		console.error(
			pc.red(error instanceof Error ? error.message : String(error)),
		)
		process.exit(1)
	}

	const { namespace, slug, path, hasSubpath } = parsed
	const baseUrl = process.env.SMITHERY_BASE_URL || DEFAULT_BASE_URL
	const url = `${baseUrl}/skills/${namespace}/${slug}/.well-known/skills/${path}`

	try {
		const response = await fetch(url)

		if (!response.ok) {
			if (response.status === 404) {
				console.error(
					pc.red(`File not found: ${path} in skill ${namespace}/${slug}`),
				)
				if (hasSubpath) {
					await showAvailableFiles(baseUrl, namespace, slug)
				}
			} else {
				console.error(
					pc.red(
						`Failed to fetch skill file (${response.status}): ${response.statusText}`,
					),
				)
			}
			process.exit(1)
		}

		const content = await response.text()
		console.log(content)

		if (!hasSubpath) {
			console.log()
			console.log(
				pc.dim(
					`Tip: View referenced files with: smithery skills view ${namespace}/${slug}/<path>`,
				),
			)
		}
	} catch (error) {
		console.error(
			pc.red(
				`Error fetching skill: ${error instanceof Error ? error.message : String(error)}`,
			),
		)
		process.exit(1)
	}
}
