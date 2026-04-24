import type { Connection as SmitheryConnection } from "@smithery/api/resources/connections.js"

export type ConnectionStatusInputRequired =
	SmitheryConnection.ConnectionStatusInputRequired

export type ConnectionInputField =
	| SmitheryConnection.ConnectionStatusInputRequired.HTTP.Headers
	| SmitheryConnection.ConnectionStatusInputRequired.HTTP.Query

export function isInputRequiredStatus(
	status: { state?: string } | null | undefined,
): status is ConnectionStatusInputRequired {
	return status?.state === "input_required"
}

export function getConnectionSetupUrl(
	status:
		| {
				state?: string
				setupUrl?: string
		  }
		| null
		| undefined,
): string | undefined {
	return status?.setupUrl
}

export function rewriteConnectionUrl(
	mcpUrl: string,
	query: Record<string, string> | undefined,
): string {
	if (!query || Object.keys(query).length === 0) {
		return mcpUrl
	}

	const url = new URL(mcpUrl)
	for (const [key, value] of Object.entries(query)) {
		url.searchParams.set(key, value)
	}
	return url.toString()
}

export function buildInputRequiredAddCommand(
	mcpUrl: string,
	status: ConnectionStatusInputRequired,
): string {
	const url = rewriteConnectionUrl(
		mcpUrl,
		Object.fromEntries(status.missing.query.map((key) => [key, "..."])),
	)
	const headers = Object.fromEntries(
		status.missing.headers.map((key) => [key, "..."]),
	)

	const parts = [`smithery mcp add '${url}'`]
	if (Object.keys(headers).length > 0) {
		parts.push(`--headers '${JSON.stringify(headers)}'`)
	}

	return parts.join(" ")
}
