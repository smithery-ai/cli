import { exec } from "node:child_process"
import { promisify } from "node:util"
import pc from "picocolors"
import yoctoSpinner from "yocto-spinner"
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

interface CliAuthOrganization {
	id: string
	name?: string
	slug?: string
	namespace?: string
}

export interface CliAuthResult {
	apiKey: string
	organization?: CliAuthOrganization
	namespace?: string
}

/**
 * Response from polling for auth completion
 */
interface PollResponse {
	status: "pending" | "success" | "error" | "organization_selection_required"
	apiKey?: string
	message?: string
	organization?: CliAuthOrganization
	namespace?: string
	organizations?: CliAuthOrganization[]
}

/**
 * Options for CLI authentication flow
 */
export interface CliAuthOptions {
	pollInterval?: number
	timeoutMs?: number
	/**
	 * WorkOS organization ID to preselect during login when supported by the
	 * Smithery auth service.
	 */
	organization?: string
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

function withOrganizationInAuthUrl(
	authUrl: string,
	organizationId: string | undefined,
): string {
	if (!organizationId) return authUrl

	try {
		const url = new URL(authUrl)
		if (!url.searchParams.has("organization_id")) {
			url.searchParams.set("organization_id", organizationId)
		}
		return url.toString()
	} catch {
		return authUrl
	}
}

/**
 * Create a new CLI authentication session
 * @param registryEndpoint Base URL for the registry
 * @returns Session ID and auth URL
 */
async function createAuthSession(
	registryEndpoint: string,
	options: CliAuthOptions,
): Promise<CliAuthSession> {
	const sessionUrl = `${registryEndpoint}/api/auth/cli/session`
	verbose(`Creating auth session at ${sessionUrl}`)
	const body = options.organization
		? JSON.stringify({ organizationId: options.organization })
		: undefined

	try {
		const response = await fetch(sessionUrl, {
			method: "POST",
			...(body && {
				headers: { "Content-Type": "application/json" },
				body,
			}),
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
		data.authUrl = withOrganizationInAuthUrl(data.authUrl, options.organization)
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

function formatOrganizationChoice(organization: CliAuthOrganization): string {
	const label = organization.name || organization.slug || organization.id
	return label === organization.id ? label : `${label} (${organization.id})`
}

async function promptForOrganizationSelection(
	organizations: CliAuthOrganization[],
): Promise<string> {
	if (!process.stdin.isTTY) {
		console.log(
			JSON.stringify({
				status: "organization_selection_required",
				organizations,
			}),
		)
		throw new Error(
			"Authentication requires organization selection. Re-run in an interactive terminal or pass --organization <organization-id>.",
		)
	}

	const inquirer = (await import("inquirer")).default
	const { organizationId } = await inquirer.prompt([
		{
			type: "list",
			name: "organizationId",
			message: "Select organization:",
			choices: organizations.map((organization) => ({
				name: formatOrganizationChoice(organization),
				value: organization.id,
			})),
		},
	])

	return organizationId
}

async function submitOrganizationSelection(
	sessionId: string,
	registryEndpoint: string,
	organizationId: string,
): Promise<PollResponse> {
	const selectUrl = `${registryEndpoint}/api/auth/cli/session/${sessionId}/organization`
	verbose(`Submitting auth organization selection at ${selectUrl}`)

	const response = await fetch(selectUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ organizationId }),
	})

	if (!response.ok) {
		const errorText = await response.text().catch(() => "")
		verbose(
			`Organization selection failed: ${response.status} ${errorText || response.statusText}`,
		)
		throw new Error(
			response.status === 404
				? "Authentication service does not support CLI organization selection yet."
				: `Failed to select organization: ${response.statusText}`,
		)
	}

	return (await response.json()) as PollResponse
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
	onOrganizationSelectionRequired?: (
		organizations: CliAuthOrganization[],
	) => Promise<string>,
): Promise<CliAuthResult> {
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
			let data = await pollWithRetry(pollUrl, 1)

			if (data.status === "success" && data.apiKey) {
				verbose("Authentication successful")
				return {
					apiKey: data.apiKey,
					organization: data.organization,
					namespace: data.namespace || data.organization?.namespace,
				}
			}

			if (data.status === "error") {
				const errorMessage = data.message || "Authentication failed"
				verbose(`Authentication error: ${errorMessage}`)
				throw new Error(errorMessage)
			}

			if (data.status === "organization_selection_required") {
				const organizations = data.organizations || []
				if (organizations.length === 0) {
					throw new Error(
						data.message ||
							"Authentication requires organization selection, but no organizations were returned.",
					)
				}
				const organizationId = onOrganizationSelectionRequired
					? await onOrganizationSelectionRequired(organizations)
					: await promptForOrganizationSelection(organizations)
				data = await submitOrganizationSelection(
					sessionId,
					registryEndpoint,
					organizationId,
				)
				if (data.status === "success" && data.apiKey) {
					verbose("Authentication successful after organization selection")
					return {
						apiKey: data.apiKey,
						organization:
							data.organization ||
							organizations.find(
								(organization) => organization.id === organizationId,
							),
						namespace: data.namespace || data.organization?.namespace,
					}
				}
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
 * @returns API key and auth context on success
 */
export async function executeCliAuthFlow(
	options: CliAuthOptions = {},
): Promise<CliAuthResult> {
	verbose(`Starting CLI auth flow with endpoint: ${SMITHERY_URL}`)
	const isTTY = process.stdin.isTTY

	// Step 1: Create session
	const sessionSpinner = isTTY
		? yoctoSpinner({
				text: "Preparing authentication...",
				color: "cyan",
			}).start()
		: null

	let session: CliAuthSession
	try {
		session = await createAuthSession(SMITHERY_URL, options)
		sessionSpinner?.success("Authentication ready")
	} catch (error) {
		sessionSpinner?.error("Failed to start authentication")
		throw error
	}

	// Step 2: Display URL and open browser
	if (isTTY) {
		console.log()
		console.log(pc.cyan("Opening browser for authentication..."))
		console.log()
		console.log(pc.bold("  If your browser doesn't open, visit:"))
		console.log(pc.blue(pc.underline(`  ${session.authUrl}`)))
		console.log()

		// Try to open browser (non-blocking)
		try {
			await openBrowserForAuth(session.authUrl)
		} catch (error) {
			// Silent failure - URL already shown above
			verbose(`Browser opening failed: ${error}`)
		}
	} else {
		// Non-TTY: output machine-readable auth URL for agents
		console.log(
			JSON.stringify({
				auth_url: session.authUrl,
				session_id: session.sessionId,
			}),
		)
	}

	// Step 3: Poll for completion
	let pollSpinner = isTTY
		? yoctoSpinner({
				text: "Waiting for you to authorize in browser...",
				color: "yellow",
			}).start()
		: null

	try {
		const authResult = await pollForApiKey(
			session.sessionId,
			SMITHERY_URL,
			options,
			async (organizations) => {
				pollSpinner?.stop()
				console.log()
				const organizationId =
					await promptForOrganizationSelection(organizations)
				pollSpinner = isTTY
					? yoctoSpinner({
							text: "Completing organization-scoped login...",
							color: "yellow",
						}).start()
					: null
				return organizationId
			},
		)
		pollSpinner?.success("Authorization received")
		return authResult
	} catch (error) {
		pollSpinner?.error("Authorization failed")
		throw error
	}
}
