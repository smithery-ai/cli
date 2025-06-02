import chalk from "chalk"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

export async function openPlayground(
	tunnelUrl: string,
	initialMessage: string,
): Promise<void> {
	const playgroundUrl = `https://smithery.ai/playground?mcp=${encodeURIComponent(
		`${tunnelUrl}/mcp`,
	)}&prompt=${encodeURIComponent(initialMessage)}`

	console.log(chalk.cyan(`🔗 Playground: ${playgroundUrl}`))

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
		console.log(chalk.green("🌐 Opened playground in browser"))
	} catch (error) {
		console.log(chalk.yellow("Could not open browser automatically"))
		console.log(chalk.gray("Please open the link manually"))
	}
}
