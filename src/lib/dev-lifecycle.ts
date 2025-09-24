import chalk from "chalk"
import { openPlayground } from "./browser"
import { startTunnel } from "./tunnel"

export async function setupTunnelAndPlayground(
	port: string,
	apiKey: string,
	autoOpen = true,
	initialMessage?: string,
): Promise<{ listener: any; url: string }> {
	const { listener, url } = await startTunnel(port, apiKey)

	console.log(
		`* Tunnel: ${chalk.cyan(`http://localhost:${port}`)} → ${chalk.cyan(url)}`,
	)

	if (autoOpen) {
		await openPlayground(url, port, initialMessage)
	}

	return { listener, url }
}
