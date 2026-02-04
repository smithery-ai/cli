import {
	APIConnectionTimeoutError,
	AuthenticationError,
	type ClientOptions,
	Smithery,
} from "@smithery/api"
import type { ServerGetResponse } from "@smithery/api/resources/servers/servers"
import { config as dotenvConfig } from "dotenv"
import { ANALYTICS_ENDPOINT } from "../constants"
import { getSessionId } from "../utils/analytics"
import type { Namespace } from "../utils/cli-utils"
import { getUserId } from "../utils/smithery-settings"
import { verbose } from "./logger"

dotenvConfig({ quiet: true })

/**
 * Creates SDK options with common configuration.
 * Base URL and API key are handled by SDK via env vars.
 */
const createSDKOptions = (apiKey?: string): ClientOptions => ({
	// Pass empty string when no API key - SDK requires non-undefined value
	// but API endpoints may still work without authentication
	apiKey: apiKey ?? "",
	timeout: 5000,
	maxRetries: 2,
})

/**
 * Get server details from registry
 * @param params.namespace The namespace of the server
 * @param params.serverName The server name within the namespace (empty string for default server)
 * @returns Details about the server and the selected connection
 */
export interface ResolvedServer {
	server: ServerGetResponse
	connection:
		| ServerGetResponse.StdioConnection
		| ServerGetResponse.HTTPConnection
}

export interface ResolveServerParams {
	namespace: Namespace
	serverName: string
}

export const resolveServer = async (
	params: ResolveServerParams,
): Promise<ResolvedServer> => {
	const { namespace, serverName } = params

	// Read API key from environment variable
	const apiKey = process.env.SMITHERY_API_KEY

	// Fire analytics event if apiKey is missing
	if (ANALYTICS_ENDPOINT) {
		;(async () => {
			try {
				const sessionId = getSessionId()
				const userId = await getUserId()
				const controller = new AbortController()
				const timeoutId = setTimeout(() => controller.abort(), 5000)
				await fetch(ANALYTICS_ENDPOINT, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						eventName: "resolve_server",
						payload: {
							namespace,
							serverName,
							hasApiKey: !!apiKey,
						},
						$session_id: sessionId,
						userId,
					}),
					signal: controller.signal,
				})
				clearTimeout(timeoutId)
			} catch (_err) {
				// Ignore analytics errors
			}
		})()
	}

	const options = createSDKOptions(apiKey)
	const smithery = new Smithery(options)
	verbose(
		`Resolving server namespace="${namespace}" serverName="${serverName}" using Smithery SDK at ${options.baseURL || "<default>"}`,
	)

	try {
		const result = await smithery.servers.get(serverName, { namespace })
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
		if (error instanceof APIConnectionTimeoutError) {
			// Preserve timeout error type
			throw error
		} else if (error instanceof AuthenticationError) {
			verbose(`Unauthorized: ${error.message}`)
			throw error
		} else if (error instanceof Error) {
			verbose(`Server error: ${error.message}`)
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
	apiKey?: string,
): Promise<
	Array<{
		qualifiedName: string
		displayName?: string
		description?: string
		useCount: number
		verified: boolean
	}>
> => {
	const options = createSDKOptions(apiKey)
	const smithery = new Smithery(options)
	verbose(`Searching servers for term: ${searchTerm}`)

	try {
		const response = await smithery.servers.list({
			q: searchTerm,
			pageSize: 10,
		})

		const servers = (response.servers || []).map((server) => ({
			qualifiedName: server.qualifiedName,
			displayName: server.displayName ?? undefined,
			description: server.description ?? undefined,
			useCount: server.useCount ?? 0,
			verified: server.verified ?? false,
		}))

		verbose(`Search returned ${servers.length} servers`)
		return servers
	} catch (error: unknown) {
		verbose(
			`Search error: ${error instanceof Error ? error.message : String(error)}`,
		)
		if (error instanceof APIConnectionTimeoutError) {
			throw error
		} else if (error instanceof AuthenticationError) {
			verbose(`Unauthorized: ${error.message}`)
			throw error
		} else if (error instanceof Error) {
			throw new Error(`Failed to search servers: ${error.message}`)
		}
		throw error
	}
}

/**
 * Validates an API key by making a test request to the registry
 * @param apiKey API key to validate
 * @returns Promise that resolves to true if valid, throws error if invalid
 * @throws AuthenticationError if API key is invalid
 */
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
	const options = createSDKOptions(apiKey)
	const smithery = new Smithery(options)
	verbose("Validating API key with Smithery SDK")

	try {
		await smithery.servers.list({ pageSize: 1 })
		verbose("API key validation successful")
		return true
	} catch (error: unknown) {
		verbose(`API key validation failed: ${JSON.stringify(error)}`)
		if (error instanceof AuthenticationError) {
			verbose("API key is invalid (unauthorized)")
			throw error
		}
		// Re-throw other errors
		throw error
	}
}
