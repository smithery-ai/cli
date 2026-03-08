import fs from "node:fs"
import type { ZodTypeAny } from "zod"
import pc from "picocolors"
import { errorMessage, fatal } from "../../lib/cli-error"
import { getApiKey } from "../../utils/smithery-settings"
import { isJsonMode, outputJson } from "../../utils/output"
import { type AutomationContext, createAutomationContext } from "./context"
import { ensureInitialized } from "./ensure-init"
import { automationPath } from "./paths"

interface AutomationModule {
	servers: string[]
	argsSchema?: ZodTypeAny
	run: (args: Record<string, unknown>, ctx: AutomationContext) => Promise<void>
}

/**
 * Parse "key=value" pairs from CLI arguments into a record.
 */
function parseArgs(rawArgs: string[]): Record<string, string> {
	const result: Record<string, string> = {}
	for (const arg of rawArgs) {
		const eqIndex = arg.indexOf("=")
		if (eqIndex === -1) {
			fatal(`Invalid argument "${arg}". Expected key=value format.`)
		}
		const key = arg.slice(0, eqIndex)
		const value = arg.slice(eqIndex + 1)
		result[key] = value
	}
	return result
}

export async function runAutomation(
	name: string,
	rawArgs: string[],
	options: { namespace?: string },
): Promise<void> {
	ensureInitialized()

	// Require authentication before running automations
	const apiKey = await getApiKey()
	if (!apiKey) {
		fatal("Not logged in. Run 'smithery login' to authenticate before running automations.")
	}

	const filePath = automationPath(name)
	if (!fs.existsSync(filePath)) {
		fatal(`Automation "${name}" not found at ${filePath}`)
	}

	const rawParsed = parseArgs(rawArgs)

	// Dynamically import the automation file using tsx loader
	let mod: AutomationModule
	try {
		mod = await import(filePath)
	} catch (e) {
		fatal(`Failed to load automation "${name}": ${errorMessage(e)}`)
	}

	if (!Array.isArray(mod.servers)) {
		fatal(
			`Automation "${name}" must export a "servers" array of MCP server URLs.`,
		)
	}
	if (typeof mod.run !== "function") {
		fatal(`Automation "${name}" must export a "run" function.`)
	}

	// Validate args against schema if provided
	let args: Record<string, unknown> = rawParsed
	if (mod.argsSchema) {
		const result = mod.argsSchema.safeParse(rawParsed)
		if (!result.success) {
			const issues = result.error.issues
				.map((i: { path: PropertyKey[]; message: string }) =>
					`  ${i.path.map(String).join(".")}: ${i.message}`,
				)
				.join("\n")
			fatal(`Invalid arguments for "${name}":\n${issues}`)
		}
		args = result.data as Record<string, unknown>
	}

	// Create the automation context (resolves connections, handles auth)
	let ctx: AutomationContext
	try {
		ctx = await createAutomationContext({
			servers: mod.servers,
			namespace: options.namespace,
		})
	} catch (e) {
		const err = e as Error & { authorizationUrl?: string }
		if (err.authorizationUrl) {
			console.error(pc.yellow(err.message))
			console.error(pc.yellow(`Authorize at: ${err.authorizationUrl}`))
			console.error(pc.dim("After authorizing, re-run this automation."))
			process.exit(1)
		}
		fatal(`Failed to connect: ${errorMessage(e)}`)
	}

	try {
		await mod.run(args, ctx)
	} catch (e) {
		if (isJsonMode()) {
			outputJson({ error: errorMessage(e) })
		}
		fatal(`Automation "${name}" failed: ${errorMessage(e)}`)
	}
}
