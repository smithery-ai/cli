import boxen from "boxen"
import chalk from "chalk"
import {
	createClickableLink,
	generateCursorDeeplink,
	generateVSCodeDeeplink,
} from "../utils/deeplink"
import { openPlayground } from "./browser"
import { startTunnel } from "./tunnel"

// TypeScript declaration for global constant injected at build time
declare const __SMITHERY_VERSION__: string

export async function setupTunnelAndPlayground(
	port: string,
	apiKey: string,
	autoOpen = true,
): Promise<{ listener: any; url: string }> {
	const { listener, url } = await startTunnel(port, apiKey)

	const playgroundUrl = `https://smithery.ai/playground?mcp=${encodeURIComponent(
		`${url}/mcp`,
	)}`

	// Generate deeplinks for clients
	const serverName = "smithery-dev"
	const deeplinkConfig = {
		name: serverName,
		type: "http" as const,
		url: `${url}/mcp`,
		headers: {},
	}

	const cursor = generateCursorDeeplink(deeplinkConfig)
	const clickableCursorLink = createClickableLink(
		cursor.url,
		cursor.displayText,
	)

	const vscode = generateVSCodeDeeplink(deeplinkConfig)
	const clickableVSCodeLink = createClickableLink(
		vscode.url,
		vscode.displayText,
	)

	console.log("")
	console.log(
		`  ${chalk.bold.italic.hex("#ea580c")("SMITHERY")} ${chalk.bold.italic.hex("#ea580c")(`v${__SMITHERY_VERSION__}`)} ready`,
	)
	console.log("")
	console.log(
		`  ${chalk.green(chalk.dim("➜"))}  ${chalk.bold(chalk.dim("Local:"))}      ${chalk.cyan(`http://localhost:${port}/mcp`)}`,
	)
	console.log(
		`  ${chalk.green(chalk.dim("➜"))}  ${chalk.bold(chalk.dim("Remote:"))}     ${chalk.cyan(`${url}/mcp`)}`,
	)
	console.log(
		`  ${chalk.green("➜")}  ${chalk.bold("Playground")}: ${chalk.cyan(playgroundUrl)}`,
	)
	console.log("")

	// Create boxed client links
	const clientLinks = [
		`${chalk.bold("Cursor")}: ${chalk.cyan(clickableCursorLink)}`,
		`${chalk.bold("VS Code")}: ${chalk.cyan(clickableVSCodeLink)}`,
		"",
		`${chalk.dim("Note: If required config needed, attach using URL params")}`,
		`${chalk.dim("e.g.")} ${chalk.dim.cyan("https://server.com/mcp")}${chalk.cyan("?weatherApiKey=abc123")}`,
	].join("\n")

	console.log(
		boxen(clientLinks, {
			title: "Add to Client",
			padding: { left: 1, right: 1, top: 0, bottom: 0 },
			margin: { left: 2 },
			borderStyle: "round",
			borderColor: "dim",
		}),
	)
	console.log("")

	if (autoOpen) {
		await openPlayground(url)
	}

	return { listener, url }
}
