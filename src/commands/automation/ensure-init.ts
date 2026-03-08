import fs from "node:fs"
import path from "node:path"
import { fatal } from "../../lib/cli-error"
import { SMITHERY_HOME } from "./paths"

/** Ensure ~/.smithery has been initialized. Exits with an error if not. */
export function ensureInitialized(): void {
	const pkgPath = path.join(SMITHERY_HOME, "package.json")
	if (!fs.existsSync(pkgPath)) {
		fatal(
			'~/.smithery is not initialized. Run "smithery automation init" first.',
		)
	}
}
