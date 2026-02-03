import { createHash } from "node:crypto"
import { writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const SMALL_OUTPUT_LIMIT = 2 * 1024 // 2KB - return inline
const MEDIUM_OUTPUT_LIMIT = 20 * 1024 // 20KB - preview + file
const PREVIEW_ITEMS = 5 // Number of items to show in preview

export interface ToolOutput {
	result: unknown
	isError: boolean
	summary?: string
	fullOutput?: string
	truncated?: boolean
	totalItems?: number
}

function generateFilePath(content: string): string {
	const hash = createHash("sha256").update(content).digest("hex").slice(0, 8)
	return join(tmpdir(), `smithery-${hash}.json`)
}

function countItems(data: unknown): number | undefined {
	if (Array.isArray(data)) {
		return data.length
	}
	if (typeof data === "object" && data !== null) {
		// Check for common array fields in MCP responses
		const obj = data as Record<string, unknown>
		for (const key of ["items", "tools", "resources", "prompts", "content"]) {
			if (Array.isArray(obj[key])) {
				return (obj[key] as unknown[]).length
			}
		}
	}
	return undefined
}

function extractPreview(data: unknown, limit: number): unknown {
	if (Array.isArray(data)) {
		return data.slice(0, limit)
	}
	if (typeof data === "object" && data !== null) {
		const obj = data as Record<string, unknown>
		// Check for common array fields and preview them
		for (const key of ["items", "tools", "resources", "prompts", "content"]) {
			if (Array.isArray(obj[key])) {
				return {
					...obj,
					[key]: (obj[key] as unknown[]).slice(0, limit),
				}
			}
		}
	}
	return data
}

function generateSummary(data: unknown, totalItems?: number): string {
	if (totalItems !== undefined) {
		return `${totalItems} items returned`
	}
	const jsonStr = JSON.stringify(data)
	return `Response: ${jsonStr.length} characters`
}

export function formatToolOutput(
	result: unknown,
	isError: boolean,
): ToolOutput {
	// For errors, always return inline
	if (isError) {
		return { result, isError: true }
	}

	const jsonStr = JSON.stringify(result)
	const size = jsonStr.length

	// Small output - return inline
	if (size <= SMALL_OUTPUT_LIMIT) {
		return { result, isError: false }
	}

	// Write full output to file
	const filePath = generateFilePath(jsonStr)
	writeFileSync(filePath, jsonStr, "utf-8")

	const totalItems = countItems(result)
	const preview = extractPreview(result, PREVIEW_ITEMS)

	// Medium output - preview + file
	if (size <= MEDIUM_OUTPUT_LIMIT) {
		return {
			result: preview,
			isError: false,
			truncated: true,
			totalItems,
			fullOutput: filePath,
		}
	}

	// Large output - summary + preview + file
	return {
		result: preview,
		isError: false,
		summary: generateSummary(result, totalItems),
		truncated: true,
		totalItems,
		fullOutput: filePath,
	}
}

export function outputJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2))
}
