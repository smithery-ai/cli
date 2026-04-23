import { lookup as dnsLookup } from "node:dns/promises"
import { isIP } from "node:net"

type LookupResult = Array<{ address: string; family: number }>

type LookupFn = (hostname: string) => Promise<LookupResult>

export type AddInvocation = {
	server?: string
	commandTokens: string[]
}

export type AddTarget =
	| {
			kind: "http"
			server: string
	  }
	| {
			kind: "uplink-http"
			mcpUrl: string
	  }
	| {
			kind: "uplink-stdio"
			command: string
			args: string[]
	  }

const OPTIONS_WITH_VALUES = new Set([
	"--id",
	"--name",
	"--metadata",
	"--headers",
	"--namespace",
	"--unstableWebhookUrl",
	"-c",
	"--client",
	"--config",
])

export function extractAddInvocation(rawArgs: string[]): AddInvocation {
	const addIndex = findAddCommandIndex(rawArgs)
	if (addIndex < 0) {
		return { commandTokens: [] }
	}

	const afterAdd = rawArgs.slice(addIndex + 1)
	const dashIndex = afterAdd.indexOf("--")
	const beforeDash =
		dashIndex >= 0 ? afterAdd.slice(0, dashIndex) : afterAdd.slice()
	const commandTokens = dashIndex >= 0 ? afterAdd.slice(dashIndex + 1) : []
	const [server] = collectOperands(beforeDash)

	return { server, commandTokens }
}

export async function classifyAddTarget(
	input: Partial<AddInvocation>,
	options: { lookup?: LookupFn } = {},
): Promise<AddTarget> {
	const commandTokens = input.commandTokens ?? []

	if (commandTokens.length > 0) {
		const [command, ...args] = commandTokens
		return {
			kind: "uplink-stdio",
			command,
			args,
		}
	}

	if (!input.server) {
		throw new Error("Missing server URL or local command.")
	}

	if (!isHttpUrl(input.server)) {
		return {
			kind: "http",
			server: input.server,
		}
	}

	const url = new URL(input.server)
	const isLoopback = await resolvesToLoopback(url.hostname, options.lookup)
	if (!isLoopback) {
		return {
			kind: "http",
			server: input.server,
		}
	}

	return {
		kind: "uplink-http",
		mcpUrl: input.server,
	}
}

function collectOperands(tokens: string[]): string[] {
	const operands: string[] = []

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index]
		if (!token) {
			continue
		}

		if (!token.startsWith("-")) {
			operands.push(token)
			continue
		}

		const [flag] = token.split("=", 1)
		if (OPTIONS_WITH_VALUES.has(flag) && !token.includes("=")) {
			index += 1
		}
	}

	return operands
}

function isHttpUrl(value: string): boolean {
	return value.startsWith("http://") || value.startsWith("https://")
}

async function resolvesToLoopback(
	hostname: string,
	lookup: LookupFn = defaultLookup,
): Promise<boolean> {
	const normalized =
		hostname.startsWith("[") && hostname.endsWith("]")
			? hostname.slice(1, -1)
			: hostname

	if (isLoopbackAddress(normalized)) {
		return true
	}

	if (isIP(normalized) !== 0) {
		return false
	}

	try {
		const addresses = await lookup(normalized)
		return (
			addresses.length > 0 &&
			addresses.every((entry) => isLoopbackAddress(entry.address))
		)
	} catch {
		return false
	}
}

async function defaultLookup(hostname: string): Promise<LookupResult> {
	return dnsLookup(hostname, { all: true, verbatim: true })
}

function isLoopbackAddress(address: string): boolean {
	if (address === "localhost" || address === "::1") {
		return true
	}

	return /^127\.\d+\.\d+\.\d+$/.test(address)
}

function findAddCommandIndex(rawArgs: string[]): number {
	for (let index = 0; index < rawArgs.length - 1; index += 1) {
		if (rawArgs[index] === "mcp" && rawArgs[index + 1] === "add") {
			return index + 1
		}
	}

	return -1
}
