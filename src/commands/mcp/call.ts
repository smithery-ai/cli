import { SmitheryAuthorizationError as MCPAuthorizationError } from "@smithery/api/mcp"
import pc from "picocolors"
import { errorMessage } from "../../lib/cli-error"
import { isJsonMode, outputJson } from "../../utils/output"
import { ConnectSession } from "./api"

/**
 * Extract the useful content from an MCP CallToolResult.
 *
 * Per the MCP spec, a tool result has:
 * - `content`: array of ContentBlocks (text, image, audio, resource, resource_link)
 * - `structuredContent`: optional structured JSON object
 * - `isError`: optional boolean
 *
 * We prefer `structuredContent` when present (it's already clean JSON).
 * Otherwise we concatenate all text content blocks.
 */
function formatToolResult(result: Record<string, unknown>): {
	output: string
	isError: boolean
} {
	const isError = result.isError === true

	// Prefer structuredContent if present
	if (result.structuredContent != null) {
		return {
			output: JSON.stringify(result.structuredContent),
			isError,
		}
	}

	// Extract from content array
	const content = result.content
	if (!Array.isArray(content) || content.length === 0) {
		return { output: "", isError }
	}

	const parts: string[] = []
	for (const block of content) {
		if (typeof block !== "object" || block === null) continue
		const b = block as Record<string, unknown>
		if (b.type === "text" && typeof b.text === "string") {
			parts.push(b.text)
		} else if (b.type === "image") {
			parts.push(`[image: ${b.mimeType ?? "unknown"}]`)
		} else if (b.type === "audio") {
			parts.push(`[audio: ${b.mimeType ?? "unknown"}]`)
		} else if (b.type === "resource") {
			const res = b.resource as Record<string, unknown> | undefined
			if (res && typeof res.text === "string") {
				parts.push(res.text)
			} else {
				parts.push(`[resource: ${res?.uri ?? "unknown"}]`)
			}
		} else if (b.type === "resource_link") {
			parts.push(`[resource_link: ${b.uri ?? "unknown"}]`)
		}
	}
	return { output: parts.join("\n"), isError }
}

export async function callTool(
	connection: string,
	tool: string,
	args: string | undefined,
	options: { namespace?: string },
): Promise<void> {
	let parsedArgs: Record<string, unknown> = {}
	if (args) {
		try {
			parsedArgs = JSON.parse(args)
		} catch (e) {
			outputJson({
				result: null,
				isError: true,
				error: `Invalid JSON args: ${errorMessage(e)}`,
			})
			process.exit(1)
		}
	}

	try {
		const session = await ConnectSession.create(options.namespace)
		const result = await session.callTool(connection, tool, parsedArgs)

		// --json: pass through the full MCP response as JSON
		if (isJsonMode()) {
			outputJson(result)
			return
		}

		const mcpResult = result as Record<string, unknown>
		const { output, isError } = formatToolResult(mcpResult)

		if (isError) {
			console.error(output)
			process.exit(1)
		}

		console.log(output)
	} catch (e) {
		if (e instanceof MCPAuthorizationError) {
			if (isJsonMode()) {
				outputJson({
					result: null,
					isError: true,
					error: `Connection "${connection}" requires authorization.`,
					authorizationUrl: e.authorizationUrl,
				})
			} else {
				console.error(
					pc.yellow(
						`Connection "${connection}" requires authorization. Authorize at:\n${e.authorizationUrl}`,
					),
				)
			}
			process.exit(1)
		}
		outputJson({
			result: null,
			isError: true,
			error: errorMessage(e),
		})
		process.exit(1)
	}
}
