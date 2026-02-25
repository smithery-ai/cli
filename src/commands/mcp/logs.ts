import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
import { createSmitheryClient } from "../../lib/smithery-client"
import { isJsonMode, outputJson, outputTable } from "../../utils/output"

export async function listLogs(
	server: string,
	options: { from?: string; to?: string; limit?: string; search?: string },
) {
	const client = await createSmitheryClient()

	try {
		const result = await client.servers.logs.list(server, {
			from: options.from,
			to: options.to,
			limit: options.limit ? Number.parseInt(options.limit, 10) : undefined,
			search: options.search,
		} as Record<string, unknown>)

		const json = isJsonMode()

		if (json) {
			outputJson(result)
			return
		}

		const data = result.invocations.map((inv) => {
			const logCount = inv.logs.length
			const exceptionCount = inv.exceptions.length
			const parts: string[] = []
			if (logCount > 0) parts.push(`${logCount} log${logCount > 1 ? "s" : ""}`)
			if (exceptionCount > 0)
				parts.push(
					pc.red(`${exceptionCount} error${exceptionCount > 1 ? "s" : ""}`),
				)

			return {
				timestamp: formatTimestamp(inv.timestamp),
				status: inv.response.status,
				outcome: inv.response.outcome,
				duration: `${inv.duration.wallMs}ms`,
				logs: parts.join(", ") || pc.dim("none"),
			}
		})

		outputTable({
			data,
			columns: [
				{ key: "timestamp", header: "TIMESTAMP" },
				{
					key: "status",
					header: "STATUS",
					format: (v) => {
						const s = Number(v)
						if (s >= 400) return pc.red(String(s))
						if (s >= 300) return pc.yellow(String(s))
						return pc.green(String(s))
					},
				},
				{ key: "outcome", header: "OUTCOME" },
				{ key: "duration", header: "DURATION" },
				{ key: "logs", header: "LOGS" },
			],
			json: false,
			jsonData: result,
			pagination: { total: result.total },
			tip:
				data.length === 0
					? "No logs found. Logs appear after the server handles requests."
					: `Showing ${data.length} of ${result.total} invocations. Use --from/--to to filter by time range, --search to filter by text.`,
		})
	} catch (error) {
		fatal("Failed to fetch logs", error)
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
