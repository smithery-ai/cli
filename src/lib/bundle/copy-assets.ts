import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import fg from "fast-glob"

export interface CopyAssetsResult {
	copiedFiles: string[]
	warnings: string[]
}

// Files that must not be overwritten by assets (would break the bundle)
const RESERVED_FILES = [
	"index.cjs", // MCPB_ENTRY_POINT - compiled server entry
	"mcpb-manifest.json", // MCPB manifest
	"manifest.json", // Temporary manifest during packing
	"server.mcpb", // Final bundle output
]

export async function copyBundleAssets(options: {
	patterns: string[]
	baseDir: string
	outDir: string
}): Promise<CopyAssetsResult> {
	const { patterns, baseDir, outDir } = options
	const copiedFiles: string[] = []
	const warnings: string[] = []

	const resolvedBaseDir = resolve(baseDir)
	const resolvedOutDir = resolve(outDir)

	for (const pattern of patterns) {
		let matchedFiles: string[]
		try {
			matchedFiles = await fg(pattern, {
				cwd: resolvedBaseDir,
				dot: true,
				onlyFiles: true,
				ignore: ["**/node_modules/**", "**/.git/**"],
			})
		} catch (e) {
			throw new Error(
				`Invalid glob pattern "${pattern}": ${e instanceof Error ? e.message : e}`,
			)
		}

		if (matchedFiles.length === 0) {
			warnings.push(`Pattern "${pattern}" matched no files`)
			continue
		}

		for (const file of matchedFiles) {
			const absoluteSourcePath = resolve(resolvedBaseDir, file)

			// Verify the file doesn't escape project root
			if (!absoluteSourcePath.startsWith(resolvedBaseDir)) {
				throw new Error(
					`Asset pattern "${pattern}" resolved to path outside project root: ${file}`,
				)
			}

			const relativePath = relative(resolvedBaseDir, absoluteSourcePath)

			// Check for reserved filenames that would break the bundle
			if (RESERVED_FILES.includes(relativePath)) {
				throw new Error(
					`Asset "${relativePath}" would overwrite a reserved bundle file. ` +
						`Reserved files: ${RESERVED_FILES.join(", ")}`,
				)
			}

			const destPath = join(resolvedOutDir, relativePath)
			const destDir = dirname(destPath)

			if (!existsSync(destDir)) {
				mkdirSync(destDir, { recursive: true })
			}

			try {
				copyFileSync(absoluteSourcePath, destPath)
				copiedFiles.push(relativePath)
			} catch (e) {
				throw new Error(
					`Failed to copy asset "${relativePath}": ${e instanceof Error ? e.message : e}`,
				)
			}
		}
	}

	return { copiedFiles, warnings }
}
