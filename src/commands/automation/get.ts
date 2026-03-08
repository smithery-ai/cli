import fs from "node:fs"
import { fatal } from "../../lib/cli-error"
import { outputDetail } from "../../utils/output"
import { ensureInitialized } from "./ensure-init"
import { automationPath } from "./paths"

export async function getAutomation(name: string): Promise<void> {
	ensureInitialized()

	const filePath = automationPath(name)
	if (!fs.existsSync(filePath)) {
		fatal(`Automation "${name}" not found at ${filePath}`)
	}

	const source = fs.readFileSync(filePath, "utf-8")

	outputDetail({
		data: {
			name,
			path: filePath,
			source,
		},
		tip: `Run it with: smithery automation run ${name} key=value`,
	})
}
