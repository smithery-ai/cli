import chalk from "chalk"

// ─── Output mode detection ──────────────────────────────────────────────────

let globalJson: boolean | undefined
let globalTable: boolean | undefined

/**
 * Set the global output mode from program-level --json / --table flags.
 * Called once from the preAction hook.
 */
export function setOutputMode(options: {
	json?: boolean
	table?: boolean
}): void {
	globalJson = options.json
	globalTable = options.table
}

/**
 * Resolve whether to use JSON output mode.
 * - --json flag → always JSON
 * - --table flag → always table
 * - Neither → auto-detect: JSON when stdout is piped (non-TTY), table when interactive
 */
export function isJsonMode(): boolean {
	if (globalTable) return false
	if (globalJson !== undefined) return globalJson
	return !process.stdout.isTTY
}

// ─── Table output ───────────────────────────────────────────────────────────

interface OutputColumn {
	key: string
	header: string
	format?: (val: unknown) => string
}

export interface PaginationInfo {
	/** Cursor-based: server-provided cursor for next page */
	nextCursor?: string | null
	/** Page-based: current page number */
	page?: number
	/** Page-based: whether more results exist */
	hasMore?: boolean
}

/**
 * Render data as a compact table (default in TTY) or compact JSON (default when piped).
 * Hints are included in both modes.
 */
export function outputTable(options: {
	data: Record<string, unknown>[]
	columns: OutputColumn[]
	json: boolean
	jsonData?: unknown
	tip?: string
	pagination?: PaginationInfo
}): void {
	const { data, columns, json, jsonData, tip, pagination } = options

	if (json) {
		const payload = jsonData ?? data
		const paginationHint = pagination ? formatPagination(pagination) : null
		console.log(
			JSON.stringify({
				...wrapArray(payload),
				...(tip ? { hint: tip } : {}),
				...(paginationHint ? { pagination: paginationHint } : {}),
			}),
		)
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

	if (pagination) {
		const msg = formatPagination(pagination)
		if (msg) {
			console.log(chalk.dim(`\n${msg}`))
		}
	}

	if (tip) {
		console.log()
		console.log(chalk.dim(`Tip: ${tip}`))
	}
}

// ─── Detail output (key-value for single records) ───────────────────────────

/**
 * Render a single record as key-value pairs (default in TTY) or compact JSON (default when piped).
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
			console.log(JSON.stringify({ ...data, hint: tip }))
		} else {
			console.log(JSON.stringify(data))
		}
		return
	}

	const keys = Object.keys(data)
	const maxKeyLen = Math.max(...keys.map((k) => k.length))

	for (const key of keys) {
		const val = data[key]
		if (val === undefined || val === null) continue
		const display = typeof val === "object" ? JSON.stringify(val) : String(val)
		console.log(`${chalk.dim(key.padEnd(maxKeyLen))}  ${display}`)
	}

	if (tip) {
		console.log()
		console.log(chalk.dim(`Tip: ${tip}`))
	}
}

// ─── Raw JSON output ────────────────────────────────────────────────────────

/**
 * Output compact JSON. Used for inherently structured responses (e.g. tools call).
 */
export function outputJson(data: unknown): void {
	console.log(JSON.stringify(data))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCell(val: unknown, format?: (val: unknown) => string): string {
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
	return `${str.slice(0, maxLen - 1)}…`
}

function formatPagination(info: PaginationInfo): string | null {
	// Cursor-based pagination
	if (info.nextCursor) {
		return `More results available. Use --cursor ${info.nextCursor}`
	}
	// Page-based pagination
	if (info.hasMore && info.page != null) {
		return `Page ${info.page}. Use --page ${info.page + 1} for next page.`
	}
	if (info.page != null && info.page > 1) {
		return `Page ${info.page} (last page).`
	}
	return null
}
