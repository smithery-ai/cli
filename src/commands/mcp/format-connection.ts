import type { Connection } from "./api"

/**
 * Format a Connection object for output, including all relevant fields.
 * Used by add, set, and get commands for consistent output.
 */
export function formatConnectionOutput(
	connection: Connection,
): Record<string, unknown> {
	const output: Record<string, unknown> = {
		connectionId: connection.connectionId,
		name: connection.name,
		mcpUrl: connection.mcpUrl,
		status: formatStatus(connection.status),
	}

	if (connection.createdAt) {
		output.createdAt = connection.createdAt
	}

	if (connection.metadata && Object.keys(connection.metadata).length > 0) {
		output.metadata = connection.metadata
	}

	if (connection.serverInfo) {
		output.serverInfo = formatServerInfo(connection.serverInfo)
	}

	if (connection.iconUrl) {
		output.iconUrl = connection.iconUrl
	}

	return output
}

function formatStatus(
	status: Connection["status"],
): Record<string, unknown> | string {
	if (!status) {
		return "unknown"
	}

	if (status.state === "connected") {
		return { state: "connected" }
	}

	if (status.state === "auth_required") {
		const result: Record<string, unknown> = { state: "auth_required" }
		if (status.authorizationUrl) {
			result.authorizationUrl = status.authorizationUrl
		}
		return result
	}

	if (status.state === "error") {
		return {
			state: "error",
			message: status.message,
		}
	}

	return "unknown"
}

function formatServerInfo(
	serverInfo: NonNullable<Connection["serverInfo"]>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {
		name: serverInfo.name,
		version: serverInfo.version,
	}

	if (serverInfo.title) {
		result.title = serverInfo.title
	}

	if (serverInfo.description) {
		result.description = serverInfo.description
	}

	if (serverInfo.websiteUrl) {
		result.websiteUrl = serverInfo.websiteUrl
	}

	return result
}
