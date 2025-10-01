import fetch from "cross-fetch"

/**
 * Default timeout for network requests in milliseconds
 */
const DEFAULT_TIMEOUT_MS = 5000 // 5 seconds

/**
 * Default number of retry attempts
 */
const DEFAULT_RETRIES = 3

/**
 * Base delay between retries in milliseconds (for exponential backoff)
 */
const BASE_RETRY_DELAY_MS = 1000

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
		retries?: number
		baseRetryDelay?: number
	} = {},
): Promise<Response> => {
	const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS
	const maxRetries = config.retries ?? DEFAULT_RETRIES
	const baseDelay = config.baseRetryDelay ?? BASE_RETRY_DELAY_MS

	let lastError: Error | undefined

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
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

			// Don't retry on the last attempt
			if (attempt < maxRetries) {
				// Exponential backoff: 1s, 2s, 4s, etc.
				const delay = baseDelay * 2 ** attempt
				await new Promise((resolve) => setTimeout(resolve, delay))
			}
		}
	}

	throw new Error(
		`Failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
	)
}

