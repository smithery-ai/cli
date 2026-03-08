import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import pc from "picocolors"
import { AUTOMATIONS_DIR, SMITHERY_HOME } from "./paths"

const PACKAGE_JSON = {
	name: "smithery-automations",
	private: true,
	type: "module",
	dependencies: {},
}

const TSCONFIG = {
	compilerOptions: {
		target: "ES2022",
		module: "ES2022",
		moduleResolution: "bundler",
		esModuleInterop: true,
		strict: true,
		skipLibCheck: true,
	},
}

export async function initAutomations(): Promise<void> {
	const pkgPath = path.join(SMITHERY_HOME, "package.json")

	if (fs.existsSync(pkgPath)) {
		console.log(pc.yellow("~/.smithery already initialized"))
		return
	}

	fs.mkdirSync(AUTOMATIONS_DIR, { recursive: true })

	fs.writeFileSync(pkgPath, JSON.stringify(PACKAGE_JSON, null, 2))
	fs.writeFileSync(
		path.join(SMITHERY_HOME, "tsconfig.json"),
		JSON.stringify(TSCONFIG, null, 2),
	)

	// Install zod as a default dependency
	try {
		execSync("npm install zod", { cwd: SMITHERY_HOME, stdio: "pipe" })
	} catch {
		console.warn(
			pc.yellow("Warning: failed to install zod. Run manually: cd ~/.smithery && npm install zod"),
		)
	}

	console.log(pc.green("Initialized ~/.smithery"))
	console.log(pc.dim("Created package.json, tsconfig.json, automations/"))
}
