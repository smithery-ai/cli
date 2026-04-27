import { execFile } from "node:child_process"
import { promisify } from "node:util"
import pc from "picocolors"
import { promptForConnectionInputs } from "../../utils/command-prompts"
import { isJsonMode } from "../../utils/output"
import type { Connection, ConnectSession } from "./api"
import {
	buildInputRequiredAddCommand,
	getConnectionSetupUrl,
	isInputRequiredStatus,
	rewriteConnectionUrl,
} from "./connection-status"

const execFileAsync = promisify(execFile)
const AUTH_POLL_INTERVAL_MS = 3000
const AUTH_POLL_TIMEOUT_MS = 60_000

export async function finalizeAddedConnection(
	session: ConnectSession,
	connection: Connection,
	options: {
		name?: string
		metadata?: Record<string, unknown>
		headers?: Record<string, string>
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
		})
		currentUrl = requireConnectionUrl(current)
	}

	return current
}

export async function completeConnectionAuthorization(
	session: ConnectSession,
	connection: Connection,
): Promise<Connection> {
	const setupUrl = getConnectionSetupUrl(connection.status)
	if (connection.status?.state !== "auth_required" || !setupUrl) {
		return connection
	}

	if (!process.stdin.isTTY || !process.stdout.isTTY || isJsonMode()) {
		console.error(pc.yellow(`Authorization required. Run: open "${setupUrl}"`))
		return connection
	}

	console.error()
	console.error(pc.cyan("Opening browser for authorization..."))
	console.error(pc.bold("If your browser doesn't open, visit:"))
	console.error(pc.blue(pc.underline(setupUrl)))
	await openSetupUrl(setupUrl)

	const deadline = Date.now() + AUTH_POLL_TIMEOUT_MS
	let latest = connection
	while (Date.now() < deadline) {
		await sleep(AUTH_POLL_INTERVAL_MS)
		latest = await session.getConnection(connection.connectionId)
		if (latest.status?.state !== "auth_required") {
			return latest
		}
	}

	console.error(pc.yellow("Authorization was not completed within 1 minute."))
	return latest
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

async function openSetupUrl(setupUrl: string): Promise<void> {
	try {
		const [command, args] = getOpenCommand(setupUrl)
		await execFileAsync(command, args)
	} catch {
		// The setup URL is already visible.
	}
}

function getOpenCommand(url: string): [string, string[]] {
	if (process.platform === "darwin") {
		return ["open", [url]]
	}
	if (process.platform === "win32") {
		return ["cmd", ["/c", "start", "", url]]
	}
	return ["xdg-open", [url]]
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function requireConnectionUrl(connection: Connection): string {
	if (!connection.mcpUrl) {
		throw new Error(
			`Connection ${connection.connectionId} is missing an MCP URL.`,
		)
	}

	return connection.mcpUrl
}
