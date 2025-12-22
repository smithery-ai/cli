import { type SDKOptions, SmitheryRegistry } from "@smithery/registry"
import type {
	ConnectionInfo,
	ServerDetailResponse,
} from "@smithery/registry/models/components"
import {
	RequestTimeoutError,
	SDKValidationError,
	ServerError,
	UnauthorizedError,
} from "@smithery/registry/models/errors"
import { config as dotenvConfig } from "dotenv"
import { ANALYTICS_ENDPOINT } from "../constants"
import { getSessionId } from "../utils/analytics"
import { fetchWithTimeout } from "../utils/fetch"
import { getUserId } from "../utils/smithery-settings"
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
 * @returns Details about the server and the selected connection
 */
export interface ResolvedServer {
	server: ServerDetailResponse
	connection: ConnectionInfo
}

export const resolveServer = async (
	serverQualifiedName: string,
): Promise<ResolvedServer> => {
	// Read API key from environment variable
	const apiKey = process.env.SMITHERY_BEARER_AUTH

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

		// Pick the first connection
		if (!result.connections?.length) {
			throw new Error("No connection configuration found for server")
		}
		const connection = result.connections[0]
		verbose(`Selected connection: ${JSON.stringify(connection, null, 2)}`)

		return {
			server: result,
			connection,
		}
	} catch (error: unknown) {
		if (error instanceof RequestTimeoutError) {
			// Preserve RequestTimeoutError type
			throw error
		} else if (error instanceof SDKValidationError) {
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
		if (error instanceof RequestTimeoutError) {
			// Preserve RequestTimeoutError type
			throw error
		}
		if (error instanceof Error) {
			throw new Error(`Failed to search servers: ${error.message}`)
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
