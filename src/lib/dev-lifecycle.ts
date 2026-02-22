import pc from "picocolors"

const brandOrange = (text: string) => `\x1b[38;2;234;88;12m${text}\x1b[39m`

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
		`  ${pc.bold(pc.italic(brandOrange("SMITHERY")))} ${pc.bold(pc.italic(brandOrange(`v${__SMITHERY_VERSION__}`)))} ready`,
	)
	console.log("")
	console.log(
		`  ${pc.green(pc.dim("➜"))}  ${pc.bold(pc.dim("Local:"))}      ${pc.cyan(`http://localhost:${port}/mcp`)}`,
	)
	console.log(
		`  ${pc.green(pc.dim("➜"))}  ${pc.bold(pc.dim("Remote:"))}     ${pc.cyan(`${url}/mcp`)}`,
	)
	console.log(
		`  ${pc.green("➜")}  ${pc.bold("Playground")}: ${pc.cyan(playgroundUrl)}`,
	)
	console.log("")

	// Display client links without boxen - OSC 8 escape sequences cause boxen
	// to miscalculate string width, leading to negative .repeat() values
	console.log(pc.dim("  ╭─ Add to Client ─────────────────────────────╮"))
	console.log(
		`  ${pc.dim("│")} ${pc.bold("Cursor")}: ${pc.cyan(clickableCursorLink)}`,
	)
	console.log(
		`  ${pc.dim("│")} ${pc.bold("VS Code")}: ${pc.cyan(clickableVSCodeLink)}`,
	)
	console.log(pc.dim("  │"))
	console.log(
		`  ${pc.dim("│")} ${pc.dim("Note: If required config needed, attach using URL params")}`,
	)
	console.log(
		`  ${pc.dim("│")} ${pc.dim("e.g.")} ${pc.dim(pc.cyan("https://server.com/mcp"))}${pc.cyan("?weatherApiKey=abc123")}`,
	)
	console.log(pc.dim("  ╰────────────────────────────────────────────╯"))

	console.log("")

	if (autoOpen) {
		await openPlayground(url)
	}

	return { listener, url }
}
