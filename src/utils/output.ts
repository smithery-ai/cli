import chalk from "chalk"

// ─── Table output ───────────────────────────────────────────────────────────

interface OutputColumn {
	key: string
	header: string
	format?: (val: unknown) => string
}

/**
 * Render data as a compact table (default) or JSON (--json).
 * Hints are included in both modes.
 */
export function outputTable(options: {
	data: Record<string, unknown>[]
	columns: OutputColumn[]
	json: boolean
	jsonData?: unknown
	tip?: string
}): void {
	const { data, columns, json, jsonData, tip } = options

	if (json) {
		const payload = jsonData ?? data
		if (tip) {
			console.log(JSON.stringify({ ...wrapArray(payload), hint: tip }, null, 2))
		} else {
			console.log(JSON.stringify(payload, null, 2))
		}
		return
	}

	if (data.length === 0) {
		if (tip) {
			console.log(chalk.dim(tip))
		}
		return
	}

	// Calculate column widths
	const widths = columns.map((col) => {
		const vals = data.map((row) => formatCell(row[col.key], col.format).length)
		return Math.max(col.header.length, ...vals)
	})

	// Print rows (no header for single row)
	if (data.length > 1) {
		const header = columns
			.map((col, i) => col.header.padEnd(widths[i]))
			.join("  ")
		console.log(chalk.dim(header))
	}

	for (const row of data) {
		const line = columns
			.map((col, i) => formatCell(row[col.key], col.format).padEnd(widths[i]))
			.join("  ")
		console.log(line)
	}

	if (tip) {
		console.log()
		console.log(chalk.dim(`Tip: ${tip}`))
	}
}

// ─── Detail output (key-value for single records) ───────────────────────────

/**
 * Render a single record as key-value pairs (default) or JSON (--json).
 * Hints are included in both modes.
 */
export function outputDetail(options: {
	data: Record<string, unknown>
	json: boolean
	tip?: string
}): void {
	const { data, json, tip } = options

	if (json) {
		if (tip) {
			console.log(JSON.stringify({ ...data, hint: tip }, null, 2))
		} else {
			console.log(JSON.stringify(data, null, 2))
		}
		return
	}

	const keys = Object.keys(data)
	const maxKeyLen = Math.max(...keys.map((k) => k.length))

	for (const key of keys) {
		const val = data[key]
		if (val === undefined || val === null) continue
		const display =
			typeof val === "object" ? JSON.stringify(val) : String(val)
		console.log(`${chalk.dim(key.padEnd(maxKeyLen))}  ${display}`)
	}

	if (tip) {
		console.log()
		console.log(chalk.dim(`Tip: ${tip}`))
	}
}

// ─── Raw JSON output ────────────────────────────────────────────────────────

/**
 * Output raw JSON. Used for inherently structured responses (e.g. tools call).
 */
export function outputJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCell(
	val: unknown,
	format?: (val: unknown) => string,
): string {
	if (val === undefined || val === null) return ""
	if (format) return format(val)
	return String(val)
}

/** Wrap an array in an object so hint can be merged at the top level. */
function wrapArray(data: unknown): Record<string, unknown> {
	if (Array.isArray(data)) {
		return { results: data }
	}
	if (typeof data === "object" && data !== null) {
		return data as Record<string, unknown>
	}
	return { result: data }
}

/** Truncate a string to maxLen, adding ellipsis if needed. */
export function truncate(str: string, maxLen = 60): string {
	if (str.length <= maxLen) return str
	return str.slice(0, maxLen - 1) + "…"
}
