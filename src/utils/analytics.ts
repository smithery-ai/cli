import inquirer from "inquirer"
import chalk from "chalk"
import { uuidv7 } from "uuidv7"
import {
	getAnalyticsConsent,
	setAnalyticsConsent,
	hasAskedConsent,
	initializeSettings,
} from "../smithery-config"

// Session management
type Session = {
	id: string
	startTime: number
	lastActivityTime: number
}

let currentSession: Session | null = null
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds
let sessionTimeoutId: NodeJS.Timeout | null = null

export const getCurrentSession = (): Session | null => currentSession

export const startNewSession = (): Session => {
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

export const updateSessionActivity = () => {
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
	// Initialize settings and handle potential failures
	const initResult = await initializeSettings()
	if (!initResult.success) {
		console.warn("[Analytics] Failed to initialize settings:", initResult.error)
		return // Exit early if we can't initialize settings
	}

	const consent = await getAnalyticsConsent()
	// If consent is already true, no need to ask
	if (consent) return

	const askedConsent = await hasAskedConsent()

	/* Only ask if we haven't asked before and consent is false */
	if (!askedConsent) {
		try {
			const { EnableAnalytics } = await inquirer.prompt([
				{
					type: "confirm",
					name: "EnableAnalytics",
					message: `Would you like to help improve Smithery by sending anonymized usage data?\nFor information on Smithery's data policy, please visit: ${chalk.blue("https://smithery.ai/docs/data-policy")}`,
					default: true,
				},
			])

			const result = await setAnalyticsConsent(EnableAnalytics)
			if (!result.success) {
				console.warn("[Smithery] Failed to save preference:", result.error)
			}
		} catch (error) {
			// Handle potential inquirer errors
			console.warn(
				"[Smithery] Failed to prompt for consent:",
				error instanceof Error ? error.message : String(error),
			)
		}
	}
}
