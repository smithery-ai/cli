import fs from "node:fs"
import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
import { ensureInitialized } from "./ensure-init"
import { AUTOMATIONS_DIR, automationPath } from "./paths"

const TEMPLATE = (name: string) => `// Automation: ${name}
// MCP server URLs this automation connects to
export const servers: string[] = [
	// e.g. "https://server.smithery.ai/linear"
]

// Run the automation deterministically — no AI, just MCP tool calls.
export async function run(
	args: Record<string, string>,
	ctx: {
		callTool: (
			server: string,
			toolName: string,
			toolArgs: Record<string, unknown>,
		) => Promise<unknown>
	},
): Promise<void> {
	// Example:
	// const result = await ctx.callTool(
	//   "https://server.smithery.ai/linear",
	//   "create_issue",
	//   { title: args["ticket-name"] }
	// )
	// console.log(result)
	console.log("Running ${name} with args:", args)
}
`

export async function createAutomation(name: string): Promise<void> {
	ensureInitialized()

	const filePath = automationPath(name)
	if (fs.existsSync(filePath)) {
		fatal(`Automation "${name}" already exists at ${filePath}`)
	}

	fs.mkdirSync(AUTOMATIONS_DIR, { recursive: true })
	fs.writeFileSync(filePath, TEMPLATE(name))

	console.log(pc.green(`Created automation: ${name}`))
	console.log(pc.dim(filePath))
	console.log()
	console.log(pc.dim("Edit the file to add your MCP servers and logic."))
	console.log(pc.dim(`Run it with: smithery automation run ${name} key=value`))
}
