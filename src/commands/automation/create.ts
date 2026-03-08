import fs from "node:fs"
import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
import { ensureInitialized } from "./ensure-init"
import { AUTOMATIONS_DIR, automationPath } from "./paths"

const TEMPLATE = (name: string) => `// Automation: ${name}
//
// Discover available tools before writing your automation:
//   smithery tool list <connection>          # browse tools from a connection
//   smithery tool find <connection> <query>  # search tools by name or intent
//
// Install extra dependencies in ~/.smithery (do NOT edit package.json directly):
//   cd ~/.smithery && npm install <package>
import { z } from "zod"

// MCP server URLs this automation connects to.
// Find servers at https://smithery.ai or use "smithery search <query>".
export const servers: string[] = [
	// e.g. "https://server.smithery.ai/@anthropic/slack-mcp"
]

// Define your input schema for validated, strongly-typed arguments.
// All CLI values arrive as strings — use z.coerce for numeric/boolean fields.
export const argsSchema = z.object({
	// e.g. title: z.string(),
	// e.g. priority: z.coerce.number().optional(),
})

// The run function receives parsed & validated args matching your schema.
export async function run(
	args: z.infer<typeof argsSchema>,
	ctx: {
		callTool: (
			server: string,
			toolName: string,
			toolArgs: Record<string, unknown>,
		) => Promise<unknown>
	},
): Promise<void> {
	// Use ctx.callTool(serverUrl, toolName, toolArgs) to call MCP tools.
	// Discover exact tool names and arguments with:
	//   smithery tool list <connection>
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
	console.log(pc.dim("Discover tools with: smithery tool list <connection>"))
	console.log(pc.dim(`Run it with: smithery automation run ${name} key=value`))
}
