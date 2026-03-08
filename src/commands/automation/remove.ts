import fs from "node:fs"
import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
import { ensureInitialized } from "./ensure-init"
import { automationPath } from "./paths"

export async function removeAutomation(name: string): Promise<void> {
	ensureInitialized()

	const filePath = automationPath(name)
	if (!fs.existsSync(filePath)) {
		fatal(`Automation "${name}" not found at ${filePath}`)
	}

	fs.unlinkSync(filePath)
	console.log(pc.green(`Removed automation: ${name}`))
}
