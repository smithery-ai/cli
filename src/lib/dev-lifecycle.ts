import { openPlayground } from "./browser"
import { startTunnel } from "./tunnel"

export async function setupTunnelAndPlayground(
	port: string,
	apiKey: string,
	autoOpen = true,
	initialMessage?: string,
): Promise<{ listener: any; url: string }> {
	const { listener, url } = await startTunnel(port, apiKey)

	if (autoOpen) {
		await openPlayground(url, initialMessage)
	}

	return { listener, url }
}
