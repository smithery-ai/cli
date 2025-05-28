import ngrok from "@ngrok/ngrok"
import chalk from "chalk"

export async function getTemporaryTunnelToken(apiKey: string): Promise<{
	authtoken: string
	domain: string
}> {
	try {
		const response = await fetch(
			`${process.env.REGISTRY_ENDPOINT}/uplink/token`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
			},
		)

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error("Unauthorized: Invalid API key")
			}
			throw new Error(`Failed to get tunnel token: ${response.statusText}`)
		}

		return await response.json()
	} catch (error) {
		throw new Error(
			`Failed to connect to Smithery API: ${error instanceof Error ? error.message : error}`,
		)
	}
}

export function detectPortFromOutput(output: string): string | null {
	const patterns = [
		/(?:localhost|127\.0\.0\.1):(\d+)/g,
		/port\s+(\d+)/gi,
		/running.*?(\d{4,5})/gi,
		/server.*?(\d{4,5})/gi,
		/http:\/\/.*?:(\d+)/gi,
	]

	for (const pattern of patterns) {
		const match = pattern.exec(output)
		if (match?.[1]) {
			const port = Number.parseInt(match[1], 10)
			if (port > 1000 && port < 65536) {
				return match[1]
			}
		}
	}
	return null
}

export async function startTunnel(
	port: string,
	apiKey: string,
): Promise<{
	listener: any
	url: string
}> {
	console.log(chalk.blue(`🚀 Starting tunnel for localhost:${port}...`))

	// Get temporary token from Smithery backend
	console.log(chalk.gray("Getting tunnel credentials..."))
	const { authtoken, domain } = await getTemporaryTunnelToken(apiKey)

	// Start tunnel using ngrok SDK with temporary token
	const listener = await ngrok.forward({
		addr: port,
		authtoken,
		domain,
	})

	const tunnelUrl = listener.url()

	if (!tunnelUrl) {
		throw new Error("Failed to get tunnel URL")
	}

	return { listener, url: tunnelUrl }
}
