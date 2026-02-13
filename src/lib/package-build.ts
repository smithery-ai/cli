import { execSync } from "node:child_process"
import {
	existsSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { pathToFileURL } from "node:url"
import chalk from "chalk"

interface SmitheryBuildAdapter {
	generate(args: string[]): Promise<{
		/** Relative path to the entry file */
		entry: string
		/** Map of relative file path → file content */
		files: Record<string, string>
	}>
}

export interface PackageBuildResult {
	/** Absolute path to the generated entry file */
	entryFile: string
	/** Removes the temp directory */
	cleanup: () => void
}

/**
 * Prepare a build from an npm package adapter.
 *
 * 1. Creates a temp directory
 * 2. Installs the package via npm
 * 3. Imports the package's `smitheryBuild` adapter
 * 4. Calls `adapter.generate(args)` to produce entry + supporting files
 * 5. Writes files to the temp directory
 * 6. Returns the entry file path and a cleanup function
 */
export async function preparePackageBuild(
	packageName: string,
	args: string[],
): Promise<PackageBuildResult> {
	const tempDir = mkdtempSync(join(tmpdir(), "smithery-build-"))

	const cleanup = () => {
		try {
			rmSync(tempDir, { recursive: true, force: true })
		} catch {
			// Best-effort cleanup
		}
	}

	try {
		// Write a minimal package.json for npm install
		const packageJson = {
			type: "module",
			dependencies: {
				[packageName]: "latest",
			},
		}
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify(packageJson, null, 2),
		)

		// Install the adapter package
		console.log(
			chalk.dim(`Installing ${chalk.cyan(packageName)}...`),
		)
		try {
			execSync("npm install", {
				cwd: tempDir,
				stdio: ["pipe", "pipe", "pipe"],
			})
		} catch (error) {
			const stderr =
				error instanceof Error && "stderr" in error
					? String((error as { stderr: unknown }).stderr)
					: ""
			throw new Error(
				`Failed to install package "${packageName}". Is the package name correct?\n${stderr}`,
			)
		}

		// Import the adapter from the installed package
		const packagePath = join(tempDir, "node_modules", packageName)
		if (!existsSync(packagePath)) {
			throw new Error(
				`Package "${packageName}" was not found after installation`,
			)
		}

		const packageUrl = pathToFileURL(packagePath).href
		const mod = await import(packageUrl)
		const adapter: SmitheryBuildAdapter | undefined = mod.smitheryBuild

		if (!adapter || typeof adapter.generate !== "function") {
			throw new Error(
				`Package "${packageName}" does not export a smitheryBuild adapter with a generate() function`,
			)
		}

		// Generate the build files
		console.log(chalk.dim("Generating build files..."))
		const result = await adapter.generate(args)

		if (!result.entry || !result.files || typeof result.files !== "object") {
			throw new Error(
				`Adapter generate() must return { entry: string, files: Record<string, string> }`,
			)
		}

		// Write all generated files to the temp directory
		for (const [filePath, content] of Object.entries(result.files)) {
			const fullPath = join(tempDir, filePath)
			const dir = join(fullPath, "..")
			if (!existsSync(dir)) {
				const { mkdirSync } = await import("node:fs")
				mkdirSync(dir, { recursive: true })
			}
			writeFileSync(fullPath, content)
		}

		const entryFile = join(tempDir, result.entry)
		if (!existsSync(entryFile)) {
			throw new Error(
				`Adapter returned entry "${result.entry}" but the file was not found in generated files`,
			)
		}

		console.log(chalk.dim(`✓ Generated ${Object.keys(result.files).length} file(s)`))

		return { entryFile, cleanup }
	} catch (error) {
		cleanup()
		throw error
	}
}
