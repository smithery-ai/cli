import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Get the entry point from package.json or provided entry point
 */
export function resolveEntryPoint(providedEntry?: string): string {
	if (providedEntry) {
		const resolvedPath = resolve(process.cwd(), providedEntry)
		if (!existsSync(resolvedPath)) {
			throw new Error(`Entry file not found at ${resolvedPath}`)
		}
		return resolvedPath
	}

	// Fall back to package.json
	const packageJsonPath = resolve(process.cwd(), "package.json")
	if (!existsSync(packageJsonPath)) {
		throw new Error(
			"No package.json found in current directory. Please run this command from your project root or specify an entry file.",
		)
	}

	let packageJson: Record<string, unknown>
	try {
		const packageContent = readFileSync(packageJsonPath, "utf-8")
		packageJson = JSON.parse(packageContent)
	} catch (error) {
		throw new Error(`Failed to parse package.json: ${error}`)
	}

	if (!packageJson.module || typeof packageJson.module !== "string") {
		throw new Error(
			'No entry point found in package.json. Please define the "module" field:\n' +
				'  "module": "./src/index.ts"\n' +
				"Or specify an entry file directly.",
		)
	}

	const entryPoint = packageJson.module
	const resolvedPath = resolve(process.cwd(), entryPoint)
	if (!existsSync(resolvedPath)) {
		throw new Error(
			`Entry file specified in package.json not found at ${resolvedPath}.\n` +
				"Check that the file exists or update your package.json",
		)
	}

	return resolvedPath
}
