import chalk from "chalk"
import { startTunnel } from "./tunnel"
import { openPlayground } from "./browser"

export async function setupTunnelAndPlayground(
	port: string,
	apiKey: string,
	autoOpen = true,
): Promise<{ listener: any; url: string }> {
	const { listener, url } = await startTunnel(port, apiKey)

	if (autoOpen) {
		await openPlayground(url)
	}

	console.log(chalk.gray("Press Ctrl+C to stop the dev server"))
	return { listener, url }
}
