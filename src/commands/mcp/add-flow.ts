import { promptForConnectionInputs } from "../../utils/command-prompts"
import { isJsonMode } from "../../utils/output"
import type { Connection, ConnectSession } from "./api"
import {
	buildInputRequiredAddCommand,
	isInputRequiredStatus,
	rewriteConnectionUrl,
} from "./connection-status"

export async function finalizeAddedConnection(
	session: ConnectSession,
	connection: Connection,
	options: {
		name?: string
		metadata?: Record<string, unknown>
		headers?: Record<string, string>
		unstableWebhookUrl?: string
	},
): Promise<Connection> {
	let current = connection
	let currentUrl = requireConnectionUrl(connection)
	let headers = { ...(options.headers ?? {}) }

	while (
		isInputRequiredStatus(current.status) &&
		process.stdin.isTTY &&
		process.stdout.isTTY &&
		!isJsonMode()
	) {
		const input = await promptForConnectionInputs(current.status)
		headers = { ...headers, ...(input.headers ?? {}) }
		currentUrl = rewriteConnectionUrl(currentUrl, input.query)
		current = await session.setConnection(current.connectionId, currentUrl, {
			name: options.name,
			metadata: options.metadata,
			headers: Object.keys(headers).length > 0 ? headers : undefined,
			unstableWebhookUrl: options.unstableWebhookUrl,
		})
		currentUrl = requireConnectionUrl(current)
	}

	return current
}

export function buildDuplicateInputRequiredTip(
	connection: Connection,
): string | undefined {
	if (!isInputRequiredStatus(connection.status)) {
		return undefined
	}

	return [
		"Remove and re-add to continue:",
		`smithery mcp remove ${connection.connectionId}`,
		buildInputRequiredAddCommand(
			requireConnectionUrl(connection),
			connection.status,
		),
	].join("\n")
}

function requireConnectionUrl(connection: Connection): string {
	if (!connection.mcpUrl) {
		throw new Error(
			`Connection ${connection.connectionId} is missing an MCP URL.`,
		)
	}

	return connection.mcpUrl
}
