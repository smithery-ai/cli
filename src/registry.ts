import fetch from "node-fetch"
import { config as dotenvConfig } from "dotenv"
import {
	type StdioConnection,
	StdioConnectionSchema,
	type ServerConfig,
	type RegistryServer,
} from "./types/registry"
import { type WSConnection, WSConnectionSchema } from "./types/registry"

// Load environment variables from .env file
dotenvConfig()

const getEndpoint = (customEndpoint?: string): string => {
	const endpoint =
		customEndpoint ||
		process.env.REGISTRY_ENDPOINT ||
		"https://registry.smithery.ai"
	if (!endpoint) {
		throw new Error("REGISTRY_ENDPOINT environment variable is not set")
	}
	return endpoint
}

export const resolvePackage = async (
	packageName: string,
	customEndpoint?: string,
): Promise<RegistryServer> => {
	const endpoint = getEndpoint(customEndpoint)

	try {
		const response = await fetch(`${endpoint}/servers/${packageName}`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		})

		if (!response.ok) {
			const errorData = await response.json().catch(() => null)
			const errorMessage = errorData?.error || (await response.text())

			if (response.status === 404) {
				throw new Error(`Server "${packageName}" not found`)
			}

			throw new Error(
				`Package resolution failed with status ${response.status}: ${errorMessage}`,
			)
		}

		return await response.json()
	} catch (error) {
		if (error instanceof Error) {
			throw error // Pass through our custom errors without wrapping
		}
		throw new Error(`Failed to resolve package: ${error}`)
	}
}

export const fetchConnection = async (
	packageName: string,
	config: ServerConfig,
	customEndpoint?: string,
): Promise<StdioConnection | WSConnection> => {
	const endpoint = getEndpoint(customEndpoint)

	try {
		const server = await resolvePackage(packageName, customEndpoint)

		// Find WS connection if available
		const wsConnection = server.connections.find((conn) => conn.type === "ws")

		// If WS connection exists and has deploymentUrl, fetch the config schema
		if (wsConnection?.type === "ws" && wsConnection.deploymentUrl) {
			try {
				const configResponse = await fetch(
					`${wsConnection.deploymentUrl}/.well-known/mcp/smithery.json`,
				)

				if (configResponse.ok) {
					const wsConfig = await configResponse.json()
					wsConnection.configSchema = wsConfig.configSchema
				}
			} catch (error) {
				console.warn(`Failed to fetch WS config schema: ${error}`)
			}
		}

		const requestBody = {
			connectionType: wsConnection ? "ws" : "stdio",
			config,
		}

		const response = await fetch(`${endpoint}/servers/${packageName}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(
				`Registry request failed with status ${response.status}: ${errorText}`,
			)
		}

		const data = await response.json()

		if (!data.success || !data.result) {
			throw new Error("Invalid server response format")
		}

		return wsConnection
			? WSConnectionSchema.parse(data.result)
			: StdioConnectionSchema.parse(data.result)
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to fetch server metadata: ${error.message}`)
		}
		throw error
	}
}
