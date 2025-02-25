import fetch from "cross-fetch" /* some runtimes use node <18 causing fetch not defined issue */
import { config as dotenvConfig } from "dotenv"
import {
	type StdioConnection,
	StdioConnectionSchema,
	type ServerConfig,
	type RegistryServer,
} from "./types/registry"
import type { WSConnection } from "./types/registry"

dotenvConfig()

const getEndpoint = (): string => {
	const endpoint =
		process.env.REGISTRY_ENDPOINT || "https://registry.smithery.ai"
	if (!endpoint) {
		throw new Error("REGISTRY_ENDPOINT environment variable is not set")
	}
	return endpoint
}

/* Get server details from registry */
export const resolvePackage = async (
	packageName: string,
): Promise<RegistryServer> => {
	const endpoint = getEndpoint()

	try {
		const response = await fetch(`${endpoint}/servers/${packageName}`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		})

		if (!response.ok) {
			const errorData = (await response.json().catch(() => null)) as {
				error?: string
			}
			const errorMessage = errorData?.error || (await response.text())

			if (response.status === 404) {
				throw new Error(`Server "${packageName}" not found`)
			}

			throw new Error(
				`Package resolution failed with status ${response.status}: ${errorMessage}`,
			)
		}

		return (await response.json()) as RegistryServer
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
): Promise<StdioConnection> => {
	const endpoint = getEndpoint()

	try {
		const requestBody = {
			connectionType: "stdio",
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

		const data = (await response.json()) as {
			success: boolean
			result?: StdioConnection | WSConnection
		}

		if (!data.success || !data.result) {
			throw new Error("Invalid registry response format")
		}

		return StdioConnectionSchema.parse(data.result)
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to fetch server connection: ${error.message}`)
		}
		throw error
	}
}
