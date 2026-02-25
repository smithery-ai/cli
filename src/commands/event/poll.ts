import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
import { isJsonMode, outputJson, outputTable } from "../../utils/output"
import { ConnectSession } from "../mcp/api"

export async function pollEvents(
	connection: string,
	options: { namespace?: string; limit?: string },
): Promise<void> {
	const isJson = isJsonMode()

	try {
		const session = await ConnectSession.create(options.namespace)
		const result = await session.pollEvents(connection, {
			limit: options.limit ? Number.parseInt(options.limit, 10) : undefined,
		})

		if (isJson) {
			outputJson(result)
			return
		}

		if (result.data.length === 0) {
			console.log(pc.dim("No events in queue."))
			return
		}

		const data = result.data.map((event) => ({
			id: String(event.id),
			method: String((event.payload as Record<string, unknown>).method ?? ""),
			createdAt: formatTimestamp(event.createdAt),
		}))

		outputTable({
			data,
			columns: [
				{ key: "id", header: "ID" },
				{ key: "method", header: "METHOD" },
				{ key: "createdAt", header: "CREATED AT" },
			],
			json: false,
			jsonData: result,
			tip: result.done
				? "All events consumed. Poll again later for new events."
				: "More events available. Poll again to retrieve the next batch.",
		})
	} catch (error) {
		fatal("Failed to poll events", error)
	}
}

function formatTimestamp(iso: string): string {
	const d = new Date(iso)
	return d.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	})
}
