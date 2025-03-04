import chalk from "chalk"
import inquirer from "inquirer"
import {
	getAnalyticsConsent,
	hasAskedConsent,
	initializeSettings,
	setAnalyticsConsent,
} from "../smithery-config"

export async function checkAnalyticsConsent(analyticsFlag?: string): Promise<void> {
	// Initialize settings and handle potential failures
	const initResult = await initializeSettings()
	if (!initResult.success) {
		console.warn("[Analytics] Failed to initialize settings:", initResult.error)
		return // Exit early if we can't initialize settings
	}

	// If analytics flag is provided, set consent accordingly
	if (analyticsFlag !== undefined) {
		const enabled = analyticsFlag.toLowerCase() === "true"
		const result = await setAnalyticsConsent(enabled)
		if (!result.success) {
			console.warn("[Smithery] Failed to save analytics preference:", result.error)
		}
		return
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
					message: `Would you like to help improve Smithery by sending anonymous usage data?\nFor information on Smithery's data policy, please visit: ${chalk.blue("https://smithery.ai/docs/data-policy")}`,
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
