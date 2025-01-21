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

interface SSEConfigResponse {
	configSchema: JSONSchema
}

export async function resolveServer(
	serverId: string,
	client = "claude",
): Promise<ResolvedServer | null> {
	try {
		const isInstalled = ConfigManager.isServerInstalled(serverId, client)
		const response = await fetch(`${REGISTRY_ENDPOINT}/servers/${serverId}`)
		// console.error(`\nRegistry response for ${serverId}:`, response.status)

		if (!response.ok) {
			// console.log(`Server not found in registry. Is installed: ${isInstalled}`)
			if (isInstalled) {
				return {
					id: serverId,
					name: serverId,
					connections: [],
					isInstalled: true,
					client: client,
				}
			}
			return null
		}

		const registryServer: RegistryServer = await response.json()
		// console.log('\nRegistry server details:', {
		// 	qualifiedName: registryServer.qualifiedName,
		// 	displayName: registryServer.displayName,
		// 	connectionTypes: registryServer.connections.map(c => c.type)
		// })

		// Process connections and normalize structure
		const processedConnections = await Promise.all(
			registryServer.connections.map(async (connection) => {
				// console.log(`\nProcessing connection type: ${connection.type}`)

				if (connection.type === "sse" && connection.deploymentUrl) {
					// console.log(`Fetching SSE config from: ${connection.deploymentUrl}`)
					try {
						const configResponse = await fetch(
							`${connection.deploymentUrl}/.well-known/mcp/smithery.json`,
						)
						// console.log('SSE config response:', configResponse.status)

						if (configResponse.ok) {
							const sseConfig: SSEConfigResponse = await configResponse.json()
							// console.log('SSE config schema received:', {
							// 	hasSchema: !!sseConfig.configSchema,
							// 	schemaProperties: Object.keys(sseConfig.configSchema?.properties || {})
							// })

							return {
								type: "sse" as const,
								deploymentUrl: connection.deploymentUrl,
								configSchema: sseConfig.configSchema,
								exampleConfig: connection.exampleConfig,
							}
						}
					} catch (error) {
						// console.warn(`Failed to fetch SSE config schema: ${error}`)
					}
				}
				// STDIO connections already have the right structure
				// console.log('STDIO connection schema:', {
				// 	hasSchema: !!connection.configSchema,
				// 	schemaProperties: Object.keys(connection.configSchema?.properties || {})
				// })
				return connection
			}),
		)

		const result = {
			id: registryServer.qualifiedName,
			name: registryServer.displayName,
			connections: processedConnections,
			isInstalled,
			client,
		}
		// console.log('\nFinal resolved server:', {
		// 	id: result.id,
		// 	name: result.name,
		// 	connectionCount: result.connections.length,
		// 	connectionTypes: result.connections.map(c => c.type)
		// })

		return result
	} catch (error) {
		console.error('Error resolving server:', error)
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
 * Checks if a server has a deployed SSE endpoint
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
