/**
 * Detect the current JavaScript runtime environment
 */
export function detectRuntime(): "bun" | "node" {
	return typeof Bun !== "undefined" ? "bun" : "node"
}

/**
 * Get the default bundler based on current runtime
 */
export function getDefaultBundler(): "bun" | "esbuild" {
	return detectRuntime() === "bun" ? "bun" : "esbuild"
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
