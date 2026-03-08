import fs from "node:fs"
import path from "node:path"
import pc from "picocolors"
import { isJsonMode, outputTable } from "../../utils/output"
import { ensureInitialized } from "./ensure-init"
import { AUTOMATIONS_DIR } from "./paths"

export async function listAutomations(): Promise<void> {
	ensureInitialized()

	if (!fs.existsSync(AUTOMATIONS_DIR)) {
		if (isJsonMode()) {
			console.log(JSON.stringify({ automations: [] }))
		} else {
			console.log(pc.yellow("No automations found."))
			console.log(pc.dim("Create one with: smithery automation create <name>"))
		}
		return
	}

	const files = fs
		.readdirSync(AUTOMATIONS_DIR)
		.filter((f) => f.endsWith(".ts"))
		.map((f) => path.basename(f, ".ts"))

	if (files.length === 0) {
		if (isJsonMode()) {
			console.log(JSON.stringify({ automations: [] }))
		} else {
			console.log(pc.yellow("No automations found."))
			console.log(pc.dim("Create one with: smithery automation create <name>"))
		}
		return
	}

	const data = files.map((name) => ({
		name,
		path: path.join(AUTOMATIONS_DIR, `${name}.ts`),
	}))

	outputTable({
		data,
		columns: [
			{ key: "name", header: "NAME" },
			{ key: "path", header: "PATH" },
		],
		json: isJsonMode(),
		jsonData: { automations: data },
		tip: "Run an automation with: smithery automation run <name> key=value",
	})
}
