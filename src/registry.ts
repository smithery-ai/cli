import fetch from "cross-fetch" /* some runtimes use node <18 causing fetch not defined issue */
import { config as dotenvConfig } from "dotenv"
import {
	type StdioConnection,
	StdioConnectionSchema,
	type ServerConfig,
	type RegistryServer,
} from "./types/registry"
import type { WSConnection } from "./types/registry"
import { verbose } from "./logger"

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
	verbose(`Resolving package ${packageName} from registry at ${endpoint}`)

	try {
		verbose(`Making GET request to ${endpoint}/servers/${packageName}`)
		const response = await fetch(`${endpoint}/servers/${packageName}`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		})
		verbose(`Response status: ${response.status}`)

		if (!response.ok) {
			const errorData = (await response.json().catch(() => null)) as {
				error?: string
			}
			const errorMessage = errorData?.error || (await response.text())
			verbose(`Error response: ${errorMessage}`)

			if (response.status === 404) {
				throw new Error(`Server "${packageName}" not found`)
			}

			throw new Error(
				`Package resolution failed with status ${response.status}: ${errorMessage}`,
			)
		}

		verbose("Successfully received server data from registry")
		const data = (await response.json()) as RegistryServer
		verbose(
			`Server ${packageName} resolved with ${data.connections.length} connection options`,
		)
		return data
	} catch (error) {
		verbose(
			`Package resolution error: ${error instanceof Error ? error.message : String(error)}`,
		)
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
	verbose(`Fetching connection for ${packageName} from registry at ${endpoint}`)
	verbose(
		`Connection config provided (keys: ${Object.keys(config).join(", ")})`,
	)

	try {
		const requestBody = {
			connectionType: "stdio",
			config,
		}
		verbose(`Sending connection request for ${packageName}`)

		verbose(`Making POST request to ${endpoint}/servers/${packageName}`)
		const response = await fetch(`${endpoint}/servers/${packageName}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
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
			result?: StdioConnection | WSConnection
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
