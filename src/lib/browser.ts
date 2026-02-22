import { exec } from "node:child_process"
import { promisify } from "node:util"
import pc from "picocolors"

const execAsync = promisify(exec)

export async function openPlayground(tunnelUrl: string): Promise<void> {
	const playgroundUrl = `https://smithery.ai/playground?mcp=${encodeURIComponent(
		`${tunnelUrl}/mcp`,
	)}&dev`

	// URL is already displayed in dev-lifecycle.ts, so no need to log it again

	try {
		const platform = process.platform
		let command: string

		switch (platform) {
			case "darwin": // macOS
				command = `open "${playgroundUrl}"`
				break
			case "win32": // Windows
				command = `start "" "${playgroundUrl}"`
				break
			default: // Linux and others
				command = `xdg-open "${playgroundUrl}"`
				break
		}

		await execAsync(command)
	} catch (_error) {
		console.log(pc.yellow("Could not open browser automatically"))
		console.log(pc.gray("Please open the link manually"))
	}
}
