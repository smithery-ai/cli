import type { ServerConfig } from "../types/registry.js"
import { maskConfig } from "../utils/cli-utils.js"
import { lazyImport, tryImport } from "./lazy-import.js"
import { verbose } from "./logger.js"

const SERVICE_NAME = "smithery"

interface Keytar {
	setPassword(service: string, account: string, password: string): Promise<void>
	getPassword(service: string, account: string): Promise<string | null>
	deletePassword(service: string, account: string): Promise<boolean>
}

let keytar: Keytar | null = null

/**
 * Try to load keytar silently. Returns null if not installed.
 * Use for operations where keytar is optional (read, delete, clear).
 */
async function getKeytar(): Promise<Keytar | null> {
	if (!keytar) {
		keytar = await tryImport<Keytar>("keytar")
		if (!keytar) {
			verbose("keytar not available - keychain features disabled")
		}
	}
	return keytar
}

/**
 * Load keytar with install prompt if missing.
 * Use for operations where keytar is needed (save).
 */
async function requireKeytar(): Promise<Keytar | null> {
	if (!keytar) {
		try {
			keytar = await lazyImport<Keytar>("keytar")
		} catch {
			verbose("keytar not available - keychain features disabled")
		}
	}
	return keytar
}
const ACCOUNT_PREFIX = "config:"

/**
 * Get the keychain account name for a server
 * Format: config:user/server
 */
function getAccountName(qualifiedName: string): string {
	return `${ACCOUNT_PREFIX}${qualifiedName}`
}

/**
 * Save server configuration to OS keychain
 * @param qualifiedName - The qualified name of the server (e.g., user/server)
 * @param config - The configuration object to save
 */
export async function saveConfig(
	qualifiedName: string,
	config: ServerConfig,
): Promise<void> {
	const kt = await requireKeytar()
	if (!kt) {
		verbose(`Keychain not available, skipping save for ${qualifiedName}`)
		return
	}

	const accountName = getAccountName(qualifiedName)
	const configJson = JSON.stringify(config)

	verbose(`Saving config to keychain for ${qualifiedName}`)
	try {
		await kt.setPassword(SERVICE_NAME, accountName, configJson)
		verbose(`Successfully saved config to keychain for ${qualifiedName}`)
	} catch (error) {
		verbose(
			`Failed to save config to keychain: ${error instanceof Error ? error.message : String(error)}`,
		)
		throw new Error(
			`Failed to save configuration to keychain: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

/**
 * Retrieve server configuration from OS keychain
 * @param qualifiedName - The qualified name of the server (e.g., user/server)
 * @returns The configuration object, or null if not found
 */
export async function getConfig(
	qualifiedName: string,
): Promise<ServerConfig | null> {
	const kt = await getKeytar()
	if (!kt) {
		verbose(`Keychain not available, skipping read for ${qualifiedName}`)
		return null
	}

	const accountName = getAccountName(qualifiedName)

	verbose(`Reading config from keychain for ${qualifiedName}`)
	try {
		const configJson = await kt.getPassword(SERVICE_NAME, accountName)
		if (!configJson) {
			verbose(`No config found in keychain for ${qualifiedName}`)
			return null
		}

		const config = JSON.parse(configJson) as ServerConfig
		const maskedConfig = maskConfig(config)
		verbose(
			`Successfully read config from keychain for ${qualifiedName}: ${JSON.stringify(maskedConfig)}`,
		)
		return config
	} catch (error) {
		verbose(
			`Failed to read config from keychain: ${error instanceof Error ? error.message : String(error)}`,
		)
		return null
	}
}

/**
 * Delete server configuration from OS keychain
 * @param qualifiedName - The qualified name of the server (e.g., user/server)
 */
export async function deleteConfig(qualifiedName: string): Promise<void> {
	const kt = await getKeytar()
	if (!kt) {
		verbose(`Keychain not available, skipping delete for ${qualifiedName}`)
		return
	}

	const accountName = getAccountName(qualifiedName)

	verbose(`Deleting config from keychain for ${qualifiedName}`)
	try {
		const deleted = await kt.deletePassword(SERVICE_NAME, accountName)
		if (deleted) {
			verbose(`Successfully deleted config from keychain for ${qualifiedName}`)
		} else {
			verbose(`No config found to delete for ${qualifiedName}`)
		}
	} catch (error) {
		verbose(
			`Failed to delete config from keychain: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

/**
 * Clear all server configurations from OS keychain
 */
export async function clearAllConfigs(): Promise<void> {
	const kt = await getKeytar()
	if (!kt) {
		verbose("Keychain not available, skipping clear all configs")
		return
	}

	verbose("Clearing all configs from keychain")
	try {
		// keytar v7.9+ has findCredentials
		const credentials = await (
			kt as Keytar & {
				findCredentials(
					service: string,
				): Promise<Array<{ account: string; password: string }>>
			}
		).findCredentials(SERVICE_NAME)
		for (const cred of credentials) {
			await kt.deletePassword(SERVICE_NAME, cred.account)
			verbose(`Deleted keychain entry: ${cred.account}`)
		}
		verbose(`Cleared ${credentials.length} keychain entries`)
	} catch (error) {
		verbose(
			`Failed to clear keychain configs: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}
