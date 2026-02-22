import pc from "picocolors"
import { lazyImport } from "./lazy-import.js"
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
	debug(pc.blue(`Starting tunnel for localhost:${port}...`))

	// Get temporary token from Smithery backend
	debug(pc.gray("Getting tunnel credentials..."))
	const { authtoken, domain } = await getTemporaryTunnelToken(apiKey)

	// Lazily import ngrok — only installed on first use
	const ngrok = await lazyImport<typeof import("@ngrok/ngrok")>("@ngrok/ngrok")

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
