import { homedir, platform } from "node:os"
import { join } from "node:path"
import { promises as fs } from "node:fs"
import { v4 as uuidv4 } from "uuid"

interface Settings {
	userId: string
	analyticsConsent: boolean
	askedConsent: boolean
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

interface SettingsResult {
	success: boolean
	data?: Settings
	error?: string
}

let settingsData: Settings | null = null
let isInitialized = false

/* Default settings with consent and hasAskedConsent as false */
const createDefaultSettings = (): Settings => ({
	userId: uuidv4(),
	analyticsConsent: false,
	askedConsent: false,
	cache: { servers: {} }
})

const getSettingsPath = (): string => {
	if (process.env.SMITHERY_CONFIG_PATH) return process.env.SMITHERY_CONFIG_PATH

	const paths = {
		win32: () => join(
			process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
			"smithery"
		),
		darwin: () => join(homedir(), "Library", "Application Support", "smithery"),
		default: () => join(homedir(), ".config", "smithery")
	}

	return (paths[platform() as keyof typeof paths] || paths.default)()
}

const validateSettings = (settings: unknown): settings is Settings => {
	if (!settings || typeof settings !== 'object') return false
	const { userId, analyticsConsent, askedConsent } = settings as Partial<Settings>
	return typeof userId === 'string' && 
		   typeof analyticsConsent === 'boolean' &&
		   typeof askedConsent === 'boolean'
}

// Enhance the error message helper to handle both read and write scenarios
const getPermissionErrorMessage = (path: string, operation: 'read' | 'write'): string => {
	return `Permission denied: Cannot ${operation} settings at ${path}
Fix with: chmod 700 "${path}"
Or use: export SMITHERY_CONFIG_PATH="/custom/path"
Running in memory-only mode (settings won't persist).`
}

/* Save settings with error handling */
const saveSettings = async (settings: Settings, path: string): Promise<SettingsResult> => {
	try {
		// Ensure directory exists
		try {
			await fs.mkdir(path, { recursive: true })
		} catch (error) {
			if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
				return {
					success: false,
					error: getPermissionErrorMessage(path, 'write')
				}
			}
			throw error // Re-throw other errors to be caught below
		}
		
		const settingsPath = join(path, "settings.json")
		await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
		return { success: true, data: settings }
	} catch (error) {
		const isPermissionError = error instanceof Error && 'code' in error && error.code === 'EACCES'
		return { 
			success: false, 
			error: isPermissionError
				? getPermissionErrorMessage(path, 'write')
				: `Failed to save settings: ${error instanceof Error ? error.message : String(error)}`
		}
	}
}

// Load settings with error handling
const loadSettings = async (path: string): Promise<SettingsResult> => {
	try {
		const settingsPath = join(path, "settings.json")
		try {
			const content = await fs.readFile(settingsPath, "utf-8")
			const parsed = JSON.parse(content)
			
			if (!validateSettings(parsed)) {
				const fixed = { ...createDefaultSettings(), ...parsed }
				if (fixed.analyticsConsent) {
					fixed.askedConsent = true
				}
				await saveSettings(fixed, path)
				return { success: true, data: fixed }
			}
			
			return { success: true, data: parsed }
		} catch (error) {
			if (error instanceof Error && 'code' in error) {
				if (error.code === 'ENOENT') {
					const defaultSettings = createDefaultSettings()
					const saveResult = await saveSettings(defaultSettings, path)
					return saveResult
				}
				if (error.code === 'EACCES') {
					return {
						success: false,
						error: getPermissionErrorMessage(path, 'read')
					}
				}
			}
			throw error // Re-throw other errors to be caught below
		}
	} catch (error) {
		return { 
			success: false, 
			error: `Failed to load settings: ${error instanceof Error ? error.message : String(error)}`
		}
	}
}

// Initialize settings with better error handling
export const initializeSettings = async (): Promise<SettingsResult> => {
	if (isInitialized && settingsData) {
		return { success: true, data: settingsData };
	}

	try {
		const settingsPath = getSettingsPath()
		
		const result = await loadSettings(settingsPath)
		if (result.success && result.data) {
			settingsData = result.data
		}
		isInitialized = true
		return result
	} catch (error) {
		// Fallback to in-memory settings if file operations fail
		settingsData = createDefaultSettings()
		isInitialized = true
		return { 
			success: true, 
			data: settingsData,
			error: `Warning: Running in memory-only mode - ${error instanceof Error ? error.message : String(error)}`
		}
	}
}

// Safe getters with proper error handling
export const getUserId = async (): Promise<string> => {
	await initializeSettings()
	return settingsData?.userId || createDefaultSettings().userId
}

export const getAnalyticsConsent = async (): Promise<boolean> => {
	const result = await initializeSettings()
	if (!result.success || !result.data) {
		// If we can't load settings, default to false
		console.warn('[Config] Failed to load analytics settings:', result.error)
		return false
	}
	return result.data.analyticsConsent
}

// Safe setter with proper error handling
export const setAnalyticsConsent = async (consent: boolean): Promise<SettingsResult> => {
	const initResult = await initializeSettings()
	if (!initResult.success || !initResult.data) {
		return initResult
	}
	
	settingsData = {
		...initResult.data,
		analyticsConsent: consent,
		askedConsent: true
	}
	
	return await saveSettings(settingsData, getSettingsPath())
}

export const hasAskedConsent = async (): Promise<boolean> => {
	await initializeSettings()
	return settingsData?.askedConsent || false
}
