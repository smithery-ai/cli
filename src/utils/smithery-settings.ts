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

export class SmitherySettings {
	private static CUSTOM_CONFIG_PATH: string | null = null
	private data: Settings | null = null
	private settingsPath: string

	constructor() {
		this.settingsPath = join(this.getSettingsPath(), "settings.json")
	}

	private getSettingsPath(): string {
		if (SmitherySettings.CUSTOM_CONFIG_PATH)
			return SmitherySettings.CUSTOM_CONFIG_PATH

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

	async initialize(): Promise<void> {
		try {
			await fs.mkdir(this.getSettingsPath(), { recursive: true })
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
						await this.handleCustomPath()
						break
					case "skip":
						this.data = { userId: uuidv4(), analyticsConsent: false }
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
				const content = await fs.readFile(
					this.settingsPath,
					"utf-8",
				)
				this.data = JSON.parse(content)

				// Ensure userId exists in loaded data
				if (this.data && !this.data.userId) {
					this.data.userId = uuidv4()
					await this.save()
				}

				// Initialize analyticsConsent if it doesn't exist
				if (this.data && this.data.analyticsConsent === undefined) {
					this.data.analyticsConsent = false // Default to false - opt-in approach
					await this.save()
				}
			} catch (error) {
				// Create new settings if file doesn't exist
				this.data = {
					userId: uuidv4(),
					analyticsConsent: false, // Default to false
					cache: { servers: {} },
				}
				await this.save()
			}
		} catch (error) {
			console.error("Failed to initialize settings:", error)
			throw error
		}
	}

	private async handleCustomPath(): Promise<void> {
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
			this.data = { userId: uuidv4(), analyticsConsent: false }
			console.warn("⚠️ Running in memory-only mode - settings will not be saved")
			return
		}

		SmitherySettings.CUSTOM_CONFIG_PATH = customPath

		try {
			const exportCmd =
				platform() === "win32"
					? `$env:SMITHERY_CONFIG_PATH="${SmitherySettings.CUSTOM_CONFIG_PATH}"`
					: `export SMITHERY_CONFIG_PATH="${SmitherySettings.CUSTOM_CONFIG_PATH}"`
			const profileFile =
				platform() === "win32"
					? join(homedir(), "Documents", "WindowsPowerShell", "profile.ps1")
					: join(homedir(), ".bashrc")

			await fs.appendFile(profileFile, `\n${exportCmd}\n`)
			console.log(`Added to ${profileFile}. Restart your shell to apply.`)
		} catch (error) {
			console.log(
				`\n⚠️ Note: Add this line to your shell profile to persist the config path:\nexport SMITHERY_CONFIG_PATH="${SmitherySettings.CUSTOM_CONFIG_PATH}"`,
			)
		}
	}

	private async save(): Promise<void> {
		await fs.writeFile(
			this.settingsPath,
			JSON.stringify(this.data, null, 2),
		)
	}

	getUserId(): string {
		if (!this.data) {
			throw new Error("Settings not initialized")
		}
		return this.data.userId
	}

	getAnalyticsConsent(): boolean {
		if (!this.data) {
			throw new Error("Settings not initialized")
		}
		return this.data.analyticsConsent ?? false
	}

	async setAnalyticsConsent(consent: boolean): Promise<void> {
		if (!this.data) {
			throw new Error("Settings not initialized")
		}
		this.data.analyticsConsent = consent
		await this.save()
	}
}
