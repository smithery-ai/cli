import * as readline from "node:readline"
import pc from "picocolors"
import { uuidv7 } from "uuidv7"
import { ANALYTICS_ENDPOINT } from "../constants"
import { verbose } from "../lib/logger"
import {
	getAnalyticsConsent,
	getUserId,
	hasAskedConsent,
	initializeSettings,
	setAnalyticsConsent,
} from "./smithery-settings"

// One-line Y/N prompt using node:readline. Avoids inquirer 8.x's readline
// pause-after-close path which throws ERR_USE_AFTER_CLOSE on Node 24+.
function promptYesNo(message: string, defaultYes: boolean): Promise<boolean> {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})
		const suffix = defaultYes ? " (Y/n) " : " (y/N) "
		rl.question(`${message}${suffix}`, (answer) => {
			rl.close()
			const trimmed = answer.trim().toLowerCase()
			if (trimmed === "") return resolve(defaultYes)
			resolve(trimmed === "y" || trimmed === "yes")
		})
	})
}

// Session management
type Session = {
	id: string
	startTime: number
	lastActivityTime: number
}

let currentSession: Session | null = null
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds
let sessionTimeoutId: NodeJS.Timeout | null = null

const _getCurrentSession = (): Session | null => currentSession

const startNewSession = (): Session => {
	if (sessionTimeoutId) {
		clearTimeout(sessionTimeoutId)
	}

	const now = Date.now()
	currentSession = {
		id: uuidv7(),
		startTime: now,
		lastActivityTime: now,
	}

	return currentSession
}

const updateSessionActivity = () => {
	if (!currentSession) {
		startNewSession()
		return
	}

	const now = Date.now()
	currentSession.lastActivityTime = now

	// Reset timeout
	if (sessionTimeoutId) {
		clearTimeout(sessionTimeoutId)
	}

	sessionTimeoutId = setTimeout(() => {
		currentSession = null
	}, SESSION_TIMEOUT)
}

export const getSessionId = (): string => {
	if (!currentSession) {
		startNewSession()
	}
	updateSessionActivity()
	return currentSession!.id
}

export async function checkAnalyticsConsent(): Promise<void> {
	try {
		verbose("Checking analytics consent...")

		// Initialize settings and handle potential failures
		const initResult = await initializeSettings()
		if (!initResult.success) {
			console.warn(
				pc.yellow("[Analytics] Failed to initialize settings:"),
				initResult.error,
			)
			verbose(
				`Analytics initialization error details: ${JSON.stringify(initResult.error)}`,
			)
			return // Exit early if we can't initialize settings
		}

		const consent = await getAnalyticsConsent()
		// If consent is already true, no need to ask
		if (consent) {
			verbose("Analytics consent already granted")
			return
		}

		const askedConsent = await hasAskedConsent()

		/* Only ask if we haven't asked before and consent is false */
		if (!askedConsent) {
			// Non-interactive shells (CI, piped stdin) can't answer the prompt.
			// Persist `askedConsent: true` with consent=false so we don't keep
			// asking on every invocation, and so the early return on the next
			// run skips this whole block.
			if (!process.stdin.isTTY) {
				verbose("Non-interactive stdin — defaulting analytics consent to false")
				await setAnalyticsConsent(false)
				return
			}

			try {
				const enable = await promptYesNo(
					"Would you like to help improve Smithery by sending anonymized usage data?",
					true,
				)
				const result = await setAnalyticsConsent(enable)
				if (!result.success) {
					console.warn(
						pc.yellow("[Smithery] Failed to save preference:"),
						result.error,
					)
					verbose(
						`Failed to save analytics preference: ${JSON.stringify(result.error)}`,
					)
				}
			} catch (error) {
				console.warn(
					pc.yellow("[Smithery] Failed to prompt for consent:"),
					error instanceof Error ? error.message : String(error),
				)
				verbose(
					`Analytics consent prompt error details: ${JSON.stringify(error)}`,
				)
			}
		}

		verbose("Analytics consent check completed")
	} catch (error) {
		// Handle any unexpected errors
		console.warn(
			pc.yellow("[Analytics] Failed to check consent:"),
			error instanceof Error ? error.message : String(error),
		)
		verbose(`Analytics consent check error details: ${JSON.stringify(error)}`)
	}
}

/**
 * Fire-and-forget analytics event. Respects user consent and ANALYTICS_ENDPOINT.
 */
export function trackEvent(
	eventName: string,
	payload: Record<string, unknown>,
) {
	if (!ANALYTICS_ENDPOINT) return

	;(async () => {
		try {
			const consent = await getAnalyticsConsent()
			if (!consent) return

			const sessionId = getSessionId()
			const userId = await getUserId()
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), 5000)
			await fetch(ANALYTICS_ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					eventName,
					payload,
					$session_id: sessionId,
					userId,
				}),
				signal: controller.signal,
			})
			clearTimeout(timeoutId)
		} catch (_err) {
			// Ignore analytics errors
		}
	})()
}
