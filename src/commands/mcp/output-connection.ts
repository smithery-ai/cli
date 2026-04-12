import { outputDetail } from "../../utils/output"
import type { Connection } from "./api"
import { formatConnectionOutput } from "./format-connection"

export function outputConnectionDetail(options: {
	connection: Connection
	tip?: string
}): void {
	const { connection, tip } = options

	outputDetail({
		data: formatConnectionOutput(connection),
		tip,
	})
}
