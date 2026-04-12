import pc from "picocolors"
import { isJsonMode, outputDetail } from "../../utils/output"
import type { Connection } from "./api"
import {
	type ConnectionInputField,
	isInputRequiredStatus,
} from "./connection-status"
import { formatConnectionOutput } from "./format-connection"

export function outputConnectionDetail(options: {
	connection: Connection
	tip?: string
}): void {
	const { connection, tip } = options

	if (isJsonMode() || !isInputRequiredStatus(connection.status)) {
		outputDetail({
			data: formatConnectionOutput(connection),
			tip,
		})
		return
	}

	const rows = [
		["connectionId", connection.connectionId],
		["name", connection.name],
		["mcpUrl", connection.mcpUrl],
		["status", connection.status.state],
	]
	const maxKeyLen = Math.max(...rows.map(([key]) => key.length))

	for (const [key, value] of rows) {
		console.log(`${pc.dim(key.padEnd(maxKeyLen))}  ${value}`)
	}

	printMissingFields(
		"Missing headers:",
		connection.status.missing.headers,
		connection.status.http.headers,
	)
	printMissingFields(
		"Missing query params:",
		connection.status.missing.query,
		connection.status.http.query,
	)

	if (tip) {
		console.log()
		console.log(pc.dim(`Tip: ${tip}`))
	}
}

function printMissingFields(
	title: string,
	keys: string[],
	fields: Record<string, ConnectionInputField> | undefined,
): void {
	if (keys.length === 0) {
		return
	}

	console.log()
	console.log(title)

	const maxKeyLen = Math.max(...keys.map((key) => key.length))
	for (const key of keys) {
		const field = fields?.[key]
		console.log(`  ${key.padEnd(maxKeyLen)}  ${field?.label ?? key}`)
		if (field?.description) {
			console.log(pc.dim(`    ${field.description}`))
		}
	}
}
