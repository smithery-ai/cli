import type { Connection } from "./api"
import {
	getConnectionSetupUrl,
	isInputRequiredStatus,
} from "./connection-status"

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

	if (connection.transport === "uplink") {
		output.transport = connection.transport
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

	return output
}

function formatStatus(
	status: Connection["status"],
): Record<string, unknown> | string {
	if (!status) {
		return "unknown"
	}

	if (status.state === "connected" || status.state === "disconnected") {
		return { state: status.state }
	}

	if (status.state === "auth_required") {
		const result: Record<string, unknown> = { state: "auth_required" }
		const setupUrl = getConnectionSetupUrl(status)
		if (setupUrl) {
			result.setupUrl = setupUrl
		}
		return result
	}

	if (status.state === "error") {
		return {
			state: "error",
			message: status.message,
		}
	}

	if (isInputRequiredStatus(status)) {
		return {
			...status,
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
