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
): Promise<{
	listener: { url: () => string | null; close: () => Promise<void> }
	url: string
}> {
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

	// Display client links without boxen - OSC 8 escape sequences cause boxen
	// to miscalculate string width, leading to negative .repeat() values
	console.log(chalk.dim("  ╭─ Add to Client ─────────────────────────────╮"))
	console.log(
		`  ${chalk.dim("│")} ${chalk.bold("Cursor")}: ${chalk.cyan(clickableCursorLink)}`,
	)
	console.log(
		`  ${chalk.dim("│")} ${chalk.bold("VS Code")}: ${chalk.cyan(clickableVSCodeLink)}`,
	)
	console.log(chalk.dim("  │"))
	console.log(
		`  ${chalk.dim("│")} ${chalk.dim("Note: If required config needed, attach using URL params")}`,
	)
	console.log(
		`  ${chalk.dim("│")} ${chalk.dim("e.g.")} ${chalk.dim.cyan("https://server.com/mcp")}${chalk.cyan("?weatherApiKey=abc123")}`,
	)
	console.log(chalk.dim("  ╰────────────────────────────────────────────╯"))

	console.log("")

	if (autoOpen) {
		await openPlayground(url)
	}

	return { listener, url }
}
