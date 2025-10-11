import { type SDKOptions, SmitheryRegistry } from "@smithery/registry"
import type { ServerDetailResponse } from "@smithery/registry/models/components"
import {
	SDKValidationError,
	ServerError,
	UnauthorizedError,
} from "@smithery/registry/models/errors"
import { config as dotenvConfig } from "dotenv"
import { ANALYTICS_ENDPOINT } from "../constants"
import {
	type ServerConfig,
	type StdioConnection,
	StdioConnectionSchema,
	type StreamableHTTPDeploymentConnection,
} from "../types/registry"
import { getSessionId } from "../utils/analytics"
import { fetchWithTimeout } from "../utils/fetch"
import { getUserId } from "../utils/smithery-config"
import { verbose } from "./logger"

dotenvConfig({ quiet: true })

const getEndpoint = (): string => {
	if (
		process.env.NODE_ENV === "development" &&
		process.env.LOCAL_REGISTRY_ENDPOINT
	) {
		return process.env.LOCAL_REGISTRY_ENDPOINT
	}
	const endpoint =
		process.env.REGISTRY_ENDPOINT || "https://registry.smithery.ai"
	if (!endpoint) {
		throw new Error("REGISTRY_ENDPOINT environment variable is not set")
	}
	return endpoint
}

/**
 * Creates SDK options with common configuration
 * @param apiKey Optional API key for authentication
 * @returns SDK options configured for the registry
 */
const createSDKOptions = (apiKey?: string): SDKOptions => {
	const options: SDKOptions = {
		bearerAuth: apiKey ?? process.env.SMITHERY_BEARER_AUTH ?? "",
		timeoutMs: 5000,
		retryConfig: {
			strategy: "backoff",
			backoff: {
				initialInterval: 1000,
				maxInterval: 4000,
				exponent: 2,
				maxElapsedTime: 15000,
			},
			retryConnectionErrors: true,
		},
	}
	if (
		process.env.NODE_ENV === "development" &&
		process.env.LOCAL_REGISTRY_ENDPOINT
	) {
		options.serverURL = process.env.LOCAL_REGISTRY_ENDPOINT
	}
	return options
}

/**
 * Get server details from registry
 * @param qualifiedName The unique name of the server to resolve
 * @param apiKey Optional API key for authentication
 * @param source Optional source of the call (install, run, inspect)
 * @returns Details about the server, including available connection options
 */
export enum ResolveServerSource {
	Install = "install",
	Run = "run",
	Inspect = "inspect",
}

export const resolveServer = async (
	serverQualifiedName: string,
	apiKey?: string,
	source?: ResolveServerSource,
): Promise<ServerDetailResponse> => {
	// Fire analytics event if apiKey is missing
	if (ANALYTICS_ENDPOINT) {
		;(async () => {
			try {
				const sessionId = getSessionId()
				const userId = await getUserId()
				await fetchWithTimeout(ANALYTICS_ENDPOINT, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						eventName: "resolve_server",
						payload: {
							serverQualifiedName,
							source,
							hasApiKey: !!apiKey,
						},
						$session_id: sessionId,
						userId,
					}),
				})
			} catch (_err) {
				// Ignore analytics errors
			}
		})()
	}

	const options = createSDKOptions(apiKey)
	const smitheryRegistry = new SmitheryRegistry(options)
	verbose(
		`Resolving package ${serverQualifiedName} using Smithery SDK at ${options.serverURL || "<default>"}`,
	)

	try {
		const result = await smitheryRegistry.servers.get({
			qualifiedName: serverQualifiedName,
		})
		verbose("Successfully received server data from Smithery SDK")
		verbose(`Server data: ${JSON.stringify(result, null, 2)}`)
		return result
	} catch (error: unknown) {
		if (error instanceof SDKValidationError) {
			verbose(`SDK validation error: ${error.pretty()}`)
			verbose(JSON.stringify(error.rawValue))
			throw error
		} else if (error instanceof UnauthorizedError) {
			verbose(`Unauthorized: ${error.message}`)
			throw error
		} else if (error instanceof ServerError) {
			verbose(`Server error: ${error.message}`)
			throw error
		} else if (error instanceof Error) {
			verbose(`Unknown error: ${error.message}`)
			throw error
		} else {
			throw new Error(`Failed to resolve package: ${String(error)}`)
		}
	}
}

/**
 * Fetches a connection for a specific package from the registry
 * @param serverQualifiedName The name of the package to connect to
 * @param config Configuration options for the server connection
 * @returns A validated StdioConnection object
 */
export const fetchConnection = async (
	serverQualifiedName: string,
	config: ServerConfig,
	apiKey: string | undefined,
): Promise<StdioConnection> => {
	const endpoint = getEndpoint()
	verbose(
		`Fetching connection for ${serverQualifiedName} from registry at ${endpoint}`,
	)
	verbose(
		`Connection config provided (keys: ${Object.keys(config).join(", ")})`,
	)

	try {
		const requestBody = {
			connectionType: "stdio",
			config,
		}
		verbose(`Sending connection request for ${serverQualifiedName}`)

		verbose(`Making POST request to ${endpoint}/servers/${serverQualifiedName}`)
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		}

		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`
		}

		const response = await fetchWithTimeout(
			`${endpoint}/servers/${serverQualifiedName}`,
			{
				method: "POST",
				headers,
				body: JSON.stringify(requestBody),
			},
		)
		verbose(`Response status: ${response.status}`)

		if (!response.ok) {
			const errorText = await response.text()
			verbose(`Error response: ${errorText}`)
			throw new Error(
				`Registry request failed with status ${response.status}: ${errorText}`,
			)
		}

		verbose("Successfully received connection data from registry")
		const data = (await response.json()) as {
			success: boolean
			result?: StdioConnection | StreamableHTTPDeploymentConnection
		}
		verbose(`Connection response received (success: ${data.success})`)

		if (!data.success || !data.result) {
			throw new Error("Invalid registry response format")
		}

		return StdioConnectionSchema.parse(data.result)
	} catch (error) {
		verbose(
			`Connection fetch error: ${error instanceof Error ? error.message : String(error)}`,
		)
		if (error instanceof Error) {
			throw new Error(`Failed to fetch server connection: ${error.message}`)
		}
		throw error
	}
}

/**
 * Gets saved user configuration for a specific server from the registry
 * @param serverQualifiedName The name of the server to get config for
 * @param apiKey API key for authentication
 * @param profile Optional profile qualified name
 * @returns Promise that resolves with the saved configuration, or null if not found
 */
export const getUserConfig = async (
	serverQualifiedName: string,
	apiKey: string,
	profile?: string,
): Promise<ServerConfig | null> => {
	const endpoint = getEndpoint()
	verbose(
		`Getting user config for ${serverQualifiedName} from registry at ${endpoint}`,
	)

	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		}

		const url = new URL(`${endpoint}/config/${serverQualifiedName}`)
		if (profile) {
			url.searchParams.set("profile", profile)
		}

		const response = await fetchWithTimeout(url.toString(), {
			method: "GET",
			headers,
		})
		verbose(`Response status: ${response.status}`)

		if (response.status === 404) {
			verbose("No saved config found")
			return null
		}

		if (!response.ok) {
			const errorText = await response.text()
			verbose(`Error response: ${errorText}`)
			throw new Error(
				`Config get request failed with status ${response.status}: ${errorText}`,
			)
		}

		verbose("Successfully retrieved user config from registry")
		const data = (await response.json()) as {
			config: ServerConfig
		}
		verbose(`Config retrieved (keys: ${Object.keys(data.config).join(", ")})`)

		return data.config
	} catch (error) {
		verbose(
			`Config get error: ${error instanceof Error ? error.message : String(error)}`,
		)
		if (error instanceof Error) {
			throw new Error(`Failed to get user config: ${error.message}`)
		}
		throw error
	}
}

/**
 * Saves user configuration for a specific server to the registry
 * @param serverQualifiedName The name of the server to save config for
 * @param config User configuration to save
 * @param apiKey API key for authentication
 * @returns Promise that resolves when config is saved successfully
 */
export const saveUserConfig = async (
	serverQualifiedName: string,
	config: ServerConfig,
	apiKey: string,
): Promise<void> => {
	const endpoint = getEndpoint()
	verbose(
		`Saving user config for ${serverQualifiedName} to registry at ${endpoint}`,
	)
	verbose(`Config to save (keys: ${Object.keys(config).join(", ")})`)

	try {
		const requestBody = {
			config,
		}
		verbose(`Sending config save request for ${serverQualifiedName}`)

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		}

		const response = await fetchWithTimeout(
			`${endpoint}/config/${serverQualifiedName}`,
			{
				method: "PUT",
				headers,
				body: JSON.stringify(requestBody),
			},
		)
		verbose(`Response status: ${response.status}`)

		if (!response.ok) {
			const errorText = await response.text()
			verbose(`Error response: ${errorText}`)
			throw new Error(
				`Config save request failed with status ${response.status}: ${errorText}`,
			)
		}

		verbose("Successfully saved user config to registry")
		const data = (await response.json()) as {
			success: boolean
			message?: string
		}
		verbose(`Config save response received (success: ${data.success})`)

		if (!data.success) {
			throw new Error(data.message || "Failed to save user configuration")
		}
	} catch (error) {
		verbose(
			`Config save error: ${error instanceof Error ? error.message : String(error)}`,
		)
		if (error instanceof Error) {
			throw new Error(`Failed to save user config: ${error.message}`)
		}
		throw error
	}
}

/**
 * Search for servers in the registry
 * @param searchTerm The search term to use
 * @param apiKey API key for authentication
 * @returns Promise that resolves with search results
 */
export const searchServers = async (
	searchTerm: string,
	apiKey: string,
): Promise<
	Array<{
		qualifiedName: string
		displayName?: string
		description?: string
		useCount: number
		// @TODO: Add verified field when API supports it
		// verified?: boolean
	}>
> => {
	const endpoint = getEndpoint()
	verbose(`Searching servers for term: ${searchTerm}`)

	try {
		const response = await fetchWithTimeout(
			`${endpoint}/servers?q=${encodeURIComponent(searchTerm)}&pageSize=10`,
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
			},
		)

		if (!response.ok) {
			throw new Error(`Search failed: ${response.statusText}`)
		}

		const searchData = await response.json()
		verbose(`Search returned ${searchData.servers?.length || 0} servers`)

		return searchData.servers || []
	} catch (error) {
		verbose(
			`Search error: ${error instanceof Error ? error.message : String(error)}`,
		)
		if (error instanceof Error) {
			throw new Error(`Failed to search servers: ${error.message}`)
		}
		throw error
	}
}

/**
 * Validates if user has complete configuration for a server
 * @param serverQualifiedName The name of the server to validate config for
 * @param apiKey API key for authentication
 * @returns Promise that resolves with validation result
 */
export const validateUserConfig = async (
	serverQualifiedName: string,
	apiKey: string,
): Promise<{
	isComplete: boolean
	missingFields: string[]
	fieldSchemas: Record<string, unknown>
}> => {
	const endpoint = getEndpoint()
	verbose(`Validating user config for ${serverQualifiedName}`)

	try {
		const response = await fetchWithTimeout(
			`${endpoint}/config/${serverQualifiedName}/validate`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
			},
		)

		if (!response.ok) {
			throw new Error(`Config validation failed: ${response.statusText}`)
		}

		const validationResult = await response.json()
		verbose(
			`Config validation result: ${JSON.stringify(validationResult, null, 2)}`,
		)

		return validationResult
	} catch (error) {
		verbose(
			`Config validation error: ${error instanceof Error ? error.message : String(error)}`,
		)
		if (error instanceof Error) {
			throw new Error(`Failed to validate config: ${error.message}`)
		}
		throw error
	}
}

/**
 * Validates an API key by making a test request to the registry
 * @param apiKey API key to validate
 * @returns Promise that resolves to true if valid, throws error if invalid
 * @throws UnauthorizedError if API key is invalid
 */
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
	const options = createSDKOptions(apiKey)
	const smitheryRegistry = new SmitheryRegistry(options)
	verbose("Validating API key with Smithery SDK")

	try {
		await smitheryRegistry.servers.list({ pageSize: 1 })
		verbose("API key validation successful")
		return true
	} catch (error: unknown) {
		verbose(`API key validation failed: ${JSON.stringify(error)}`)
		if (error instanceof UnauthorizedError) {
			verbose("API key is invalid (unauthorized)")
			throw error
		}
		// Re-throw other errors
		throw error
	}
}
