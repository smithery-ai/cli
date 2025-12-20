import * as keytar from "keytar"
import type { ServerConfig } from "../types/registry.js"
import { verbose } from "./logger.js"

const SERVICE_NAME = "smithery"
const ACCOUNT_PREFIX = "config:"

/**
 * Get the keychain account name for a server
 * Format: config:@user/server
 */
function getAccountName(qualifiedName: string): string {
	return `${ACCOUNT_PREFIX}${qualifiedName}`
}

/**
 * Save server configuration to OS keychain
 * @param qualifiedName - The qualified name of the server (e.g., @user/server)
 * @param config - The configuration object to save
 */
export async function saveConfig(
	qualifiedName: string,
	config: ServerConfig,
): Promise<void> {
	const accountName = getAccountName(qualifiedName)
	const configJson = JSON.stringify(config)

	verbose(`Saving config to keychain for ${qualifiedName}`)
	try {
		await keytar.setPassword(SERVICE_NAME, accountName, configJson)
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
 * @param qualifiedName - The qualified name of the server (e.g., @user/server)
 * @returns The configuration object, or null if not found
 */
export async function getConfig(
	qualifiedName: string,
): Promise<ServerConfig | null> {
	const accountName = getAccountName(qualifiedName)

	verbose(`Reading config from keychain for ${qualifiedName}`)
	try {
		const configJson = await keytar.getPassword(SERVICE_NAME, accountName)
		if (!configJson) {
			verbose(`No config found in keychain for ${qualifiedName}`)
			return null
		}

		const config = JSON.parse(configJson) as ServerConfig
		verbose(`Successfully read config from keychain for ${qualifiedName}`)
		return config
	} catch (error) {
		verbose(
			`Failed to read config from keychain: ${error instanceof Error ? error.message : String(error)}`,
		)
		// Return null instead of throwing - allows graceful handling
		return null
	}
}

/**
 * Delete server configuration from OS keychain
 * @param qualifiedName - The qualified name of the server (e.g., @user/server)
 */
export async function deleteConfig(qualifiedName: string): Promise<void> {
	const accountName = getAccountName(qualifiedName)

	verbose(`Deleting config from keychain for ${qualifiedName}`)
	try {
		const deleted = await keytar.deletePassword(SERVICE_NAME, accountName)
		if (deleted) {
			verbose(`Successfully deleted config from keychain for ${qualifiedName}`)
		} else {
			verbose(`No config found to delete for ${qualifiedName}`)
		}
	} catch (error) {
		verbose(
			`Failed to delete config from keychain: ${error instanceof Error ? error.message : String(error)}`,
		)
		// Don't throw - allow uninstall to continue even if keychain deletion fails
	}
}
