import { homedir, platform } from "node:os"
import { join } from "node:path"
import { promises as fs } from "node:fs"
import { v4 as uuidv4 } from "uuid"
import inquirer from "inquirer"

interface Settings {
	userId: string
	analyticsConsent?: boolean
	cache?: {
		servers?: Record<
			string,
			{
				lastFetched: number
				data: unknown
			}
		>
	}
}

let customConfigPath: string | null = null
let settingsData: Settings | null = null

function getSettingsPath(): string {
	if (customConfigPath) return customConfigPath

	const envPath = process.env.SMITHERY_CONFIG_PATH
	if (envPath) return envPath

	switch (platform()) {
		case "win32":
			return join(
				process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
				"smithery",
			)
		case "darwin":
			return join(homedir(), "Library", "Application Support", "smithery")
		default:
			return join(homedir(), ".config", "smithery")
	}
}

async function handleCustomPath(): Promise<void> {
	const { customPath } = await inquirer.prompt([
		{
			type: "input",
			name: "customPath",
			message: 'Enter custom writable directory path (or "skip"):',
			validate: async (input: string) => {
				if (input.toLowerCase() === "skip") return true
				try {
					await fs.access(input, fs.constants.W_OK)
					return true
				} catch (error) {
					return `Path "${input}" is not writable. Please try another location, or type "skip" to continue without saving settings.`
				}
			},
		},
	])

	if (customPath.toLowerCase() === "skip") {
		settingsData = { userId: uuidv4(), analyticsConsent: false }
		console.warn("⚠️ Running in memory-only mode - settings will not be saved")
		return
	}

	customConfigPath = customPath

	try {
		const exportCmd =
			platform() === "win32"
				? `$env:SMITHERY_CONFIG_PATH="${customConfigPath}"`
				: `export SMITHERY_CONFIG_PATH="${customConfigPath}"`
		const profileFile =
			platform() === "win32"
				? join(homedir(), "Documents", "WindowsPowerShell", "profile.ps1")
				: join(homedir(), ".bashrc")

		await fs.appendFile(profileFile, `\n${exportCmd}\n`)
		console.log(`Added to ${profileFile}. Restart your shell to apply.`)
	} catch (error) {
		console.log(
			`\n⚠️ Note: Add this line to your shell profile to persist the config path:\nexport SMITHERY_CONFIG_PATH="${customConfigPath}"`,
		)
	}
}

async function saveSettings(): Promise<void> {
	const settingsPath = join(getSettingsPath(), "settings.json")
	await fs.writeFile(settingsPath, JSON.stringify(settingsData, null, 2))
}

export async function initializeSettings(): Promise<void> {
	const settingsPath = join(getSettingsPath(), "settings.json")

	try {
		await fs.mkdir(getSettingsPath(), { recursive: true })
	} catch (error: unknown) {
		if (
			typeof error === "object" &&
			error &&
			"code" in error &&
			error.code === "EACCES"
		) {
			const { action } = await inquirer.prompt([
				{
					type: "list",
					name: "action",
					message: "Default config directory not writable. Choose action:",
					choices: [
						{ name: "Specify custom path", value: "custom" },
						{ name: "Continue without saving settings", value: "skip" },
					],
				},
			])

			switch (action) {
				case "custom":
					await handleCustomPath()
					break
				case "skip":
					settingsData = { userId: uuidv4(), analyticsConsent: false }
					console.warn(
						"⚠️ Running in memory-only mode - settings will not be saved",
					)
					return
			}
		} else {
			throw error
		}
	}

	try {
		try {
			const content = await fs.readFile(settingsPath, "utf-8")
			settingsData = JSON.parse(content)

			if (settingsData && !settingsData.userId) {
				settingsData.userId = uuidv4()
				await saveSettings()
			}

			if (settingsData && settingsData.analyticsConsent === undefined) {
				settingsData.analyticsConsent = false
				await saveSettings()
			}
		} catch (error) {
			settingsData = {
				userId: uuidv4(),
				analyticsConsent: false,
				cache: { servers: {} },
			}
			await saveSettings()
		}
	} catch (error) {
		console.error("Failed to initialize settings:", error)
		throw error
	}
}

export function getUserId(): string {
	if (!settingsData) {
		throw new Error("Settings not initialized")
	}
	return settingsData.userId
}

export function getAnalyticsConsent(): boolean {
	if (!settingsData) {
		throw new Error("Settings not initialized")
	}
	return settingsData.analyticsConsent ?? false
}

export async function setAnalyticsConsent(consent: boolean): Promise<void> {
	if (!settingsData) {
		throw new Error("Settings not initialized")
	}
	settingsData.analyticsConsent = consent
	await saveSettings()
}
