import os from "node:os"
import path from "node:path"

/** Root directory for the user's Smithery automations project. */
export const SMITHERY_HOME = path.join(os.homedir(), ".smithery")

/** Directory containing individual automation files. */
export const AUTOMATIONS_DIR = path.join(SMITHERY_HOME, "automations")

/** Resolve the file path for an automation by name. */
export function automationPath(name: string): string {
	return path.join(AUTOMATIONS_DIR, `${name}.ts`)
}
