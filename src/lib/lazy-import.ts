import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import pc from "picocolors"

// Injected at build time from package.json devDependencies
declare const __LAZY_DEPS__: Record<string, string>

function getCliRoot(): string {
	const distDir = dirname(fileURLToPath(import.meta.url))
	const root = dirname(distDir) // dist/ -> package root
	if (!existsSync(join(root, "package.json"))) {
		throw new Error("Could not locate CLI package root")
	}
	return root
}

function isModuleNotFound(err: unknown): boolean {
	const code = (err as { code?: string })?.code
	return code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND"
}

/**
 * Import a package that may not be installed yet.
 * If missing, prompts the user to install it (or auto-installs in CI),
 * then retries the import.
 */
export async function lazyImport<T = unknown>(packageName: string): Promise<T> {
	// Attempt 1: try to load
	try {
		return (await import(packageName)) as T
	} catch (err) {
		if (!isModuleNotFound(err)) throw err
	}

	// Missing — resolve version from build-time constants
	const version = __LAZY_DEPS__?.[packageName]
	if (!version) {
		throw new Error(`"${packageName}" is required but not installed.`)
	}

	const spec = `${packageName}@${version}`

	if (process.stdin.isTTY) {
		const inquirer = (await import("inquirer")).default
		const { ok } = await inquirer.prompt<{ ok: boolean }>([
			{
				type: "confirm",
				name: "ok",
				message: `"${packageName}" is required for this command. Install ${spec}? (one-time setup)`,
				default: true,
			},
		])
		if (!ok) throw new Error(`"${packageName}" is required. Aborting.`)
	} else {
		console.log(pc.dim(`Auto-installing ${spec} (non-interactive)...`))
	}

	// Install into CLI's own node_modules
	const cliRoot = getCliRoot()
	const yoctoSpinner = (await import("yocto-spinner")).default
	const spinner = yoctoSpinner({ text: `Installing ${spec}...` }).start()

	try {
		execSync(`npm install --no-save ${spec}`, {
			cwd: cliRoot,
			stdio: ["pipe", "pipe", "pipe"],
		})
		spinner.success(`Installed ${packageName}`)
	} catch (e) {
		spinner.error(`Failed to install ${packageName}`)
		const msg = e instanceof Error ? e.message : String(e)
		if (msg.includes("EACCES") || msg.includes("permission denied")) {
			throw new Error(`Permission denied. Try: sudo npm install -g ${spec}`)
		}
		throw new Error(`Failed to install "${packageName}": ${msg}`)
	}

	// Attempt 2: retry after install
	return (await import(packageName)) as T
}
