import chalk from "chalk"
import { openPlayground } from "./browser"
import { startTunnel } from "./tunnel"

// TypeScript declaration for global constant injected at build time
declare const __SMITHERY_VERSION__: string

export async function setupTunnelAndPlayground(
	port: string,
	apiKey: string,
	autoOpen = true,
	initialMessage?: string,
): Promise<{ listener: any; url: string }> {
	const { listener, url } = await startTunnel(port, apiKey)

	const playgroundUrl = `https://smithery.ai/playground?mcp=${encodeURIComponent(
		`${url}/mcp`,
	)}`

	console.log("")
	console.log(
		`  ${chalk.bold.italic.hex("#ea580c")("SMITHERY")} ${chalk.bold.italic.hex("#ea580c")(`v${__SMITHERY_VERSION__}`)} ready`,
	)
	console.log("")
	console.log(
		`  ${chalk.green(chalk.dim("➜"))}  ${chalk.bold(chalk.dim("Local:"))}      ${chalk.cyan(`http://localhost:${port}/`)}`,
	)
	console.log(
		`  ${chalk.green(chalk.dim("➜"))}  ${chalk.bold(chalk.dim("Remote:"))}     ${chalk.cyan(url)}`,
	)
	console.log(
		`  ${chalk.green("➜")}  ${chalk.bold("Playground")}: ${chalk.cyan(playgroundUrl)}`,
	)
	console.log("")

	if (autoOpen) {
		await openPlayground(url, port, initialMessage)
	}

	return { listener, url }
}
