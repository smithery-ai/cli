import fetch from "cross-fetch"

/**
 * Default timeout for network requests in milliseconds
 */
const DEFAULT_TIMEOUT_MS = 5000 // 5 seconds

/**
 * Backoff configuration for retries
 */
export type BackoffConfig = {
	initialInterval: number
	maxInterval: number
	exponent: number
	maxElapsedTime: number
}

/**
 * Default backoff configuration
 */
const DEFAULT_BACKOFF: BackoffConfig = {
	initialInterval: 1000,
	maxInterval: 4000,
	exponent: 2,
	maxElapsedTime: 15000, // Total max time across all retries
}

/**
 * Fetch with timeout and retry support using exponential backoff
 * @param url URL to fetch
 * @param options Fetch options
 * @param config Configuration for timeout and retries
 * @returns Promise that resolves with the fetch response
 * @throws Error if all retries fail or request times out
 */
export const withTimeout = async (
	url: string,
	options: RequestInit = {},
	config: {
		timeout?: number
		backoff?: Partial<BackoffConfig>
	} = {},
): Promise<Response> => {
	const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS
	const backoff: BackoffConfig = {
		...DEFAULT_BACKOFF,
		...config.backoff,
	}

	const startTime = Date.now()
	let attempt = 0
	let lastError: Error | undefined

	while (true) {
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), timeout)

		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal,
			})
			clearTimeout(timeoutId)
			return response
		} catch (error) {
			clearTimeout(timeoutId)

			if (error instanceof Error) {
				if (error.name === "AbortError") {
					lastError = new Error(
						`Request timed out after ${timeout}ms when calling ${url}`,
					)
				} else {
					lastError = error
				}
			} else {
				lastError = new Error(String(error))
			}

			const elapsedTime = Date.now() - startTime

			// Check if we've exceeded max elapsed time
			if (elapsedTime >= backoff.maxElapsedTime) {
				throw new Error(`Failed after ${elapsedTime}ms: ${lastError?.message}`)
			}

			// Calculate next retry delay using exponential backoff
			const delay = Math.min(
				backoff.initialInterval * backoff.exponent ** attempt,
				backoff.maxInterval,
			)

			// Check if next attempt would exceed max elapsed time
			if (elapsedTime + delay >= backoff.maxElapsedTime) {
				throw new Error(`Failed after ${elapsedTime}ms: ${lastError?.message}`)
			}

			await new Promise((resolve) => setTimeout(resolve, delay))
			attempt++
		}
	}
}
