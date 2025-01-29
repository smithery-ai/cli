import dotenv from "dotenv"
import type {
	ConfiguredServer,
	ConnectionDetails,
	RegistryServer,
	ResolvedServer,
} from "../types/registry.js"
import { ConfigManager } from "./config-manager.js"
import type { JSONSchema } from "../types/registry.js"
import { REGISTRY_ENDPOINT } from "../constants.js"
dotenv.config()

export async function fetchServers(
	client: string,
	serverIds: string[] = [],
): Promise<ResolvedServer[]> {
	try {
		if (serverIds.length === 0) {
			return []
		}

		// Fetch all servers in parallel
		const serverPromises = serverIds.map((id) => resolveServer(id, client))
		const resolvedServers = await Promise.all(serverPromises)

		// Filter out null results
		return resolvedServers.filter(
			(server): server is ResolvedServer => server !== null,
		)
	} catch (error) {
		throw new Error(
			`Failed to resolve servers: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

interface WSConfigResponse {
	configSchema: JSONSchema
}

export async function resolveServer(
	serverId: string,
	client = "claude",
): Promise<ResolvedServer | null> {
	try {
		const isInstalled = ConfigManager.isServerInstalled(serverId, client)
		const response = await fetch(`${REGISTRY_ENDPOINT}/servers/${serverId}`)

		if (!response.ok) {
			if (isInstalled) {
				return {
					qualifiedName: serverId,
					name: serverId,
					connections: [],
					isInstalled: true,
					client: client,
				}
			}
			return null
		}

		const registryServer: RegistryServer = await response.json()

		// Process connections and normalize structure
		const processedConnections = await Promise.all(
			registryServer.connections.map(async (connection) => {
				// console.log(`\nProcessing connection type: ${connection.type}`)

				if (connection.type === "ws" && connection.deploymentUrl) {
					try {
						const configResponse = await fetch(
							`${connection.deploymentUrl}/.well-known/mcp/smithery.json`,
						)

						if (configResponse.ok) {
							const wsConfig: WSConfigResponse = await configResponse.json()

							return {
								type: "ws" as const,
								deploymentUrl: connection.deploymentUrl,
								configSchema: wsConfig.configSchema,
								exampleConfig: connection.exampleConfig,
							}
						}
					} catch (error) {
					}
				}
				return connection
			}),
		)

		const result = {
			qualifiedName: registryServer.qualifiedName,
			name: registryServer.displayName,
			connections: processedConnections,
			isInstalled,
			client,
		}

		return result
	} catch (error) {
		console.error("Error resolving server:", error)
		return null
	}
}

interface RegistryResponse {
	success: boolean
	result: ConfiguredServer
}

export async function getServerConfiguration(
	serverId: string,
	configValues: Record<string, unknown>,
	connectionType: ConnectionDetails["type"] = "stdio",
): Promise<ConfiguredServer | null> {
	try {
		const requestBody = {
			connectionType,
			config: configValues,
		}

		const response = await fetch(`${REGISTRY_ENDPOINT}/servers/${serverId}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		})

		try {
			const parsed: RegistryResponse = await response.json()

			return parsed.result
		} catch (parseError: unknown) {
			const errorMessage =
				parseError instanceof Error
					? parseError.message
					: "Unknown parsing error"
			throw new Error(`Invalid JSON response from registry: ${errorMessage}`)
		}
	} catch (error) {
		// console.error("Error getting server configuration:", error)
		return null
	}
}

/**
 * Checks if a server has a deployed endpoint
 * Returns the deployment URL if available, null otherwise
 */
export async function getServerDeploymentUrl(
	serverId: string,
): Promise<string | null> {
	try {
		const response = await fetch(
			`${REGISTRY_ENDPOINT}/servers/${serverId}/deployment`,
		)

		if (!response.ok) {
			return null
		}

		const data = await response.json()
		if (!data.deploymentUrl) {
			return null
		}

		return data.deploymentUrl
	} catch (error) {
		// console.error('Error checking server deployment:', error)
		return null
	}
}
