import { readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { toFile } from "@smithery/api/uploads"
import pc from "picocolors"
import yoctoSpinner from "yocto-spinner"
import { fatal } from "../../lib/cli-error"
import { resolveNamespace } from "../../lib/namespace.js"
import { createSmitheryClientSync } from "../../lib/smithery-client"
import { ensureApiKey } from "../../utils/runtime.js"
import { getNamespace } from "../../utils/smithery-settings"
import { createArchiveFromDirectory, parseSkillName } from "./publish-utils"

interface PublishOptions {
	name?: string
	namespace?: string
}

function isUrl(str: string): boolean {
	return str.startsWith("https://") || str.startsWith("http://")
}

function isArchiveFile(path: string): boolean {
	return path.endsWith(".zip") || path.endsWith(".skill")
}

export async function publishSkill(
	pathArg: string = ".",
	options: PublishOptions = {},
) {
	// Authenticate early — needed for all paths
	const apiKey = await ensureApiKey()
	const client = createSmitheryClientSync(apiKey)

	// Resolve namespace: explicit flag > saved default > interactive
	const namespace =
		options.namespace ??
		(await getNamespace()) ??
		(await resolveNamespace(client))

	if (isUrl(pathArg)) {
		return publishFromUrl(client, namespace, pathArg, options)
	}

	return publishFromPath(client, namespace, pathArg, options)
}

async function publishFromUrl(
	client: ReturnType<typeof createSmitheryClientSync>,
	namespace: string,
	gitUrl: string,
	options: PublishOptions,
) {
	const slug = options.name
	if (!slug) {
		fatal("Could not determine skill name from a URL. Provide --name.")
	}

	const spinner = yoctoSpinner({ text: "Publishing skill..." }).start()

	try {
		const result = await client.skills.set(slug, {
			namespace,
			body: { gitUrl },
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
		spinner.error("Publish failed")
		fatal("Failed to publish skill", error)
	}
}

async function publishFromPath(
	client: ReturnType<typeof createSmitheryClientSync>,
	namespace: string,
	pathArg: string,
	options: PublishOptions,
) {
	const fullPath = resolve(pathArg)
	let stat: ReturnType<typeof statSync>
	try {
		stat = statSync(fullPath)
	} catch {
		fatal(`Path not found: ${fullPath}`)
	}

	let archiveData: Uint8Array
	let slug: string | undefined = options.name

	if (stat.isFile() && isArchiveFile(fullPath)) {
		archiveData = new Uint8Array(readFileSync(fullPath))
		if (!slug) {
			fatal("Could not determine skill name from a zip file. Provide --name.")
		}
	} else if (stat.isDirectory()) {
		const skillMdPath = join(fullPath, "SKILL.md")
		let skillMdContent: string
		try {
			skillMdContent = readFileSync(skillMdPath, "utf-8")
		} catch {
			fatal(
				`SKILL.md not found in ${fullPath}. A skill must contain a SKILL.md file.`,
			)
		}

		slug = slug ?? parseSkillName(skillMdContent) ?? undefined
		if (!slug) {
			fatal(
				"Could not determine skill name. Either provide --name or add a 'name' field to SKILL.md frontmatter.",
			)
		}

		archiveData = createArchiveFromDirectory(fullPath)
	} else {
		fatal(`${fullPath} is not a directory or a .zip/.skill file.`)
	}

	const spinner = yoctoSpinner({ text: "Uploading skill..." }).start()

	const archive = await toFile(archiveData, "archive.zip", {
		type: "application/zip",
	})

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
