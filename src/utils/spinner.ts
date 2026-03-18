import yoctoSpinner from "yocto-spinner"
import { isJsonMode } from "./output"

/**
 * Minimal spinner interface used throughout the CLI.
 * Both real yocto-spinner instances and the no-op implement this.
 */
export interface Spinner {
	start(): Spinner
	stop(): Spinner
	success(text?: string): Spinner
	error(text?: string): Spinner
}

const noopSpinner: Spinner = {
	start: () => noopSpinner,
	stop: () => noopSpinner,
	success: () => noopSpinner,
	error: () => noopSpinner,
}

/**
 * Create a spinner that is suppressed in JSON / non-TTY mode.
 * Returns a fluent no-op when output should be machine-readable,
 * avoiding timers, intervals, and noisy stderr writes.
 */
export function createSpinner(
	text: string,
	options?: { color?: string },
): Spinner {
	if (isJsonMode()) {
		return noopSpinner
	}

	return yoctoSpinner({
		text,
		...(options?.color ? { color: options.color } : {}),
	} as Parameters<typeof yoctoSpinner>[0]).start()
}
