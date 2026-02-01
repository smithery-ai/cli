import chalk from "chalk"
import inquirer from "inquirer"
import { uuidv7 } from "uuidv7"
import { verbose } from "../lib/logger"
import {
	getAnalyticsConsent,
	hasAskedConsent,
	initializeSettings,
	setAnalyticsConsent,
} from "./smithery-settings"

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
				chalk.yellow("[Analytics] Failed to initialize settings:"),
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
			try {
				const { EnableAnalytics } = await inquirer.prompt([
					{
						type: "confirm",
						name: "EnableAnalytics",
						message: `Would you like to help improve Smithery by sending anonymized usage data?`,
						default: true,
					},
				])

				const result = await setAnalyticsConsent(EnableAnalytics)
				if (!result.success) {
					console.warn(
						chalk.yellow("[Smithery] Failed to save preference:"),
						result.error,
					)
					verbose(
						`Failed to save analytics preference: ${JSON.stringify(result.error)}`,
					)
				}
			} catch (error) {
				// Handle potential inquirer errors
				console.warn(
					chalk.yellow("[Smithery] Failed to prompt for consent:"),
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
			chalk.yellow("[Analytics] Failed to check consent:"),
			error instanceof Error ? error.message : String(error),
		)
		verbose(`Analytics consent check error details: ${JSON.stringify(error)}`)
	}
}
