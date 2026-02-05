import { exec } from "node:child_process"
import { promisify } from "node:util"
import chalk from "chalk"
import cliSpinners from "cli-spinners"
import ora from "ora"
import { verbose } from "./logger.js"

const execAsync = promisify(exec)

const DEFAULT_POLL_INTERVAL = 2000 // 2 seconds
const DEFAULT_TIMEOUT = 300000 // 5 minutes
const MAX_RETRIES = 3

/**
 * Response from creating a CLI auth session
 */
interface CliAuthSession {
	sessionId: string
	authUrl: string
}

/**
 * Response from polling for auth completion
 */
interface PollResponse {
	status: "pending" | "success" | "error"
	apiKey?: string
	message?: string
}

/**
 * Options for CLI authentication flow
 */
export interface CliAuthOptions {
	pollInterval?: number
	timeoutMs?: number
}

/**
 * Sleep for specified milliseconds
 */
async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if an error is a network error
 */
function isNetworkError(error: unknown): boolean {
	if (error instanceof Error) {
		return (
			error.message.includes("ECONNREFUSED") ||
			error.message.includes("ENOTFOUND") ||
			error.message.includes("ETIMEDOUT") ||
			error.message.includes("fetch failed")
		)
	}
	return false
}

/**
 * Create a new CLI authentication session
 * @param registryEndpoint Base URL for the registry
 * @returns Session ID and auth URL
 */
async function createAuthSession(
	registryEndpoint: string,
): Promise<CliAuthSession> {
	const sessionUrl = `${registryEndpoint}/api/auth/cli/session`
	verbose(`Creating auth session at ${sessionUrl}`)

	try {
		const response = await fetch(sessionUrl, {
			method: "POST",
		})

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error")
			verbose(`Session creation failed: ${response.status} ${errorText}`)

			if (response.status >= 500) {
				throw new Error(
					"Authentication service unavailable. Please try again later.",
				)
			}

			throw new Error(
				`Failed to create authentication session: ${response.statusText}`,
			)
		}

		const data = (await response.json()) as CliAuthSession
		verbose(`Session created: ${data.sessionId}`)
		return data
	} catch (error) {
		if (isNetworkError(error)) {
			throw new Error(
				"Cannot connect to Smithery. Please check your internet connection.",
			)
		}
		throw error
	}
}

/**
 * Open the user's browser to the auth URL
 * @param authUrl URL for the user to visit
 */
async function openBrowserForAuth(authUrl: string): Promise<void> {
	try {
		const platform = process.platform
		let command: string

		switch (platform) {
			case "darwin": // macOS
				command = `open "${authUrl}"`
				break
			case "win32": // Windows
				command = `start "" "${authUrl}"`
				break
			default: // Linux and others
				command = `xdg-open "${authUrl}"`
				break
		}

		verbose(`Opening browser with command: ${command}`)
		await execAsync(command)
	} catch (error) {
		// Silent failure - URL is already displayed to the user
		verbose(`Failed to open browser: ${error}`)
	}
}

/**
 * Poll the auth API for completion with retry logic
 * @param pollUrl URL to poll
 * @param attempt Current attempt number
 * @returns Poll response
 */
async function pollWithRetry(
	pollUrl: string,
	attempt: number,
): Promise<PollResponse> {
	try {
		verbose(`Polling ${pollUrl} (attempt ${attempt})`)
		const response = await fetch(pollUrl)

		if (!response.ok) {
			// Server errors - retry with backoff
			if (response.status >= 500 && attempt < MAX_RETRIES) {
				const backoffMs = 1000 * attempt // 1s, 2s, 3s
				verbose(`Server error ${response.status}, retrying in ${backoffMs}ms`)
				await sleep(backoffMs)
				return pollWithRetry(pollUrl, attempt + 1)
			}

			// 404/410 likely means session expired
			if (response.status === 404 || response.status === 410) {
				throw new Error("Session expired. Please run 'smithery login' again.")
			}

			throw new Error(
				`Polling failed: ${response.status} ${response.statusText}`,
			)
		}

		return (await response.json()) as PollResponse
	} catch (error) {
		// Network errors - retry with backoff
		if (isNetworkError(error) && attempt < MAX_RETRIES) {
			const backoffMs = 1000 * attempt
			verbose(`Network error, retrying in ${backoffMs}ms`)
			await sleep(backoffMs)
			return pollWithRetry(pollUrl, attempt + 1)
		}
		throw error
	}
}

/**
 * Poll for API key until success, error, or timeout
 * @param sessionId Session ID from createAuthSession
 * @param registryEndpoint Base URL for the registry
 * @param options Polling options
 * @returns API key on success
 */
async function pollForApiKey(
	sessionId: string,
	registryEndpoint: string,
	options: CliAuthOptions,
): Promise<string> {
	const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL
	const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT
	const maxPolls = Math.floor(timeoutMs / pollInterval)

	const pollUrl = `${registryEndpoint}/api/auth/cli/poll/${sessionId}`
	verbose(
		`Starting to poll for auth completion (max ${maxPolls} attempts, ${pollInterval}ms interval)`,
	)

	let attempts = 0
	while (attempts < maxPolls) {
		attempts++

		try {
			const data = await pollWithRetry(pollUrl, 1)

			if (data.status === "success" && data.apiKey) {
				verbose("Authentication successful")
				return data.apiKey
			}

			if (data.status === "error") {
				const errorMessage = data.message || "Authentication failed"
				verbose(`Authentication error: ${errorMessage}`)
				throw new Error(errorMessage)
			}

			// status === "pending", keep polling
			verbose(`Poll ${attempts}/${maxPolls}: still pending`)
		} catch (error) {
			// If it's a session expired error or other non-retryable error, throw immediately
			if (
				error instanceof Error &&
				(error.message.includes("Session expired") ||
					error.message.includes("Authentication failed"))
			) {
				throw error
			}

			// For network errors that exceeded retries, throw
			if (
				error instanceof Error &&
				isNetworkError(error) &&
				!error.message.includes("retrying")
			) {
				throw new Error(
					"Connection lost during authentication. Please check your internet connection and try again.",
				)
			}

			// For other errors during poll, log and continue
			verbose(`Poll error (continuing): ${error}`)
		}

		await sleep(pollInterval)
	}

	// Timeout reached
	throw new Error("Authentication timed out after 5 minutes. Please try again.")
}

// Auth endpoints are on the website, not the API
const SMITHERY_URL = process.env.SMITHERY_URL || "https://smithery.ai"

/**
 * Execute the complete CLI authentication flow
 * @param options Authentication options
 * @returns API key on success
 */
export async function executeCliAuthFlow(
	options: CliAuthOptions = {},
): Promise<string> {
	verbose(`Starting CLI auth flow with endpoint: ${SMITHERY_URL}`)

	// Step 1: Create session
	const sessionSpinner = ora({
		text: "Preparing authentication...",
		spinner: cliSpinners.dots,
		color: "cyan",
	}).start()

	let session: CliAuthSession
	try {
		session = await createAuthSession(SMITHERY_URL)
		sessionSpinner?.succeed("Authentication ready")
	} catch (error) {
		sessionSpinner?.fail("Failed to start authentication")
		throw error
	}

	// Step 2: Display URL and open browser
	console.log()
	console.log(chalk.cyan("Opening browser for authentication..."))
	console.log()
	console.log(chalk.bold("  If your browser doesn't open, visit:"))
	console.log(chalk.blue.underline(`  ${session.authUrl}`))
	console.log()

	// Try to open browser (non-blocking)
	try {
		await openBrowserForAuth(session.authUrl)
	} catch (error) {
		// Silent failure - URL already shown above
		verbose(`Browser opening failed: ${error}`)
	}

	// Step 3: Poll for completion
	const pollSpinner = ora({
		text: "Waiting for you to authorize in browser...",
		spinner: cliSpinners.dots,
		color: "yellow",
	}).start()

	try {
		const apiKey = await pollForApiKey(session.sessionId, SMITHERY_URL, options)
		pollSpinner.succeed("Authorization received")
		return apiKey
	} catch (error) {
		pollSpinner.fail("Authorization failed")
		throw error
	}
}
