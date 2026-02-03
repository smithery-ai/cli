import chalk from "chalk"
import { debug } from "./logger"
import { createSmitheryClientSync } from "./smithery-client"

async function getTemporaryTunnelToken(apiKey: string): Promise<{
	authtoken: string
	domain: string
}> {
	const client = createSmitheryClientSync(apiKey)
	return client.uplink.createToken()
}

export async function startTunnel(
	port: string,
	apiKey: string,
): Promise<{
	listener: { url: () => string | null; close: () => Promise<void> }
	url: string
}> {
	debug(chalk.blue(`Starting tunnel for localhost:${port}...`))

	// Get temporary token from Smithery backend
	debug(chalk.gray("Getting tunnel credentials..."))
	const { authtoken, domain } = await getTemporaryTunnelToken(apiKey)

	// Dynamically import ngrok to prevent loading it during build commands
	const ngrok = await import("@ngrok/ngrok")

	// Start tunnel using ngrok SDK with temporary token
	const listener = await ngrok.default.forward({
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
