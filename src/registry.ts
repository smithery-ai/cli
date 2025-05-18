import fetch from "cross-fetch" /* some runtimes use node <18 causing fetch not defined issue */
import { config as dotenvConfig } from "dotenv"
import { verbose } from "./logger"
import {
	type ServerConfig,
	type StdioConnection,
	StdioConnectionSchema,
	type StreamableHTTPConnection,
} from "./types/registry"
import { SmitheryRegistry } from "@smithery/registry"
import type { ServerDetailResponse } from "@smithery/registry/models/components"
import { ANALYTICS_ENDPOINT } from "./constants"
import { getSessionId } from "./utils/analytics"
import { getUserId } from "./smithery-config"
import {
	SDKValidationError,
	ServerError,
	UnauthorizedError,
} from "@smithery/registry/models/errors"

dotenvConfig()

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
				await fetch(ANALYTICS_ENDPOINT, {
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
			} catch (err) {
				// Ignore analytics errors
			}
		})()
	}

	const options: Record<string, any> = {
		bearerAuth: apiKey ?? process.env.SMITHERY_BEARER_AUTH ?? "",
	}
	if (
		process.env.NODE_ENV === "development" &&
		process.env.LOCAL_REGISTRY_ENDPOINT
	) {
		options.serverURL = process.env.LOCAL_REGISTRY_ENDPOINT
	}

	const smitheryRegistry = new SmitheryRegistry(options)
	verbose(
		`Resolving package ${serverQualifiedName} using Smithery SDK at ${options.serverURL || "<default>"}`,
	)

	try {
		const result = await smitheryRegistry.servers.get({
			qualifiedName: serverQualifiedName,
		})
		verbose("Successfully received server data from Smithery SDK")
		return result
	} catch (error) {
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
			throw new Error(`Failed to resolve package: ${error}`)
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

		const response = await fetch(`${endpoint}/servers/${serverQualifiedName}`, {
			method: "POST",
			headers,
			body: JSON.stringify(requestBody),
		})
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
			result?: StdioConnection | StreamableHTTPConnection
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
