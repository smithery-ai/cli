import ngrok from "@ngrok/ngrok"
import chalk from "chalk"
import { spawn, type ChildProcess } from "node:child_process"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

async function getTemporaryTunnelToken(apiKey: string): Promise<{
	authtoken: string
	domain: string
}> {
	try {
		const response = await fetch(
			`${process.env.REGISTRY_ENDPOINT}/uplink/token`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
			},
		)

		if (!response.ok) {
			throw new Error(`Failed to get tunnel token: ${response.statusText}`)
		}

		return await response.json()
	} catch (error) {
		throw new Error(
			`Failed to connect to Smithery API: ${error instanceof Error ? error.message : error}`,
		)
	}
}

// Auto-detect port from command output
function detectPortFromOutput(output: string): string | null {
	const patterns = [
		/(?:localhost|127\.0\.0\.1):(\d+)/g,
		/port\s+(\d+)/gi,
		/running.*?(\d{4,5})/gi,
		/server.*?(\d{4,5})/gi,
		/http:\/\/.*?:(\d+)/gi,
	]

	for (const pattern of patterns) {
		const match = pattern.exec(output)
		if (match?.[1]) {
			const port = Number.parseInt(match[1], 10)
			if (port > 1000 && port < 65536) {
				return match[1]
			}
		}
	}
	return null
}

// Start subprocess and wait for port detection
function startSubprocess(
	command: string,
	preferredPort: string,
): Promise<{
	process: ChildProcess
	detectedPort: string
}> {
	return new Promise((resolve, reject) => {
		console.log(chalk.blue(`🔧 Starting: ${command}`))

		const [cmd, ...args] = command.split(/\s+/)
		const childProcess = spawn(cmd, args, {
			stdio: ["inherit", "pipe", "pipe"],
			shell: true,
			env: {
				...process.env,
				PORT: preferredPort,
			},
		})

		let output = ""
		let detectedPort: string | null = null
		const timeout = setTimeout(() => {
			if (!detectedPort) {
				reject(new Error("Timeout: Could not detect port from command output"))
			}
		}, 30000) // 30 second timeout

		const processOutput = (data: Buffer) => {
			const chunk = data.toString()
			output += chunk
			process.stdout.write(chunk) // Forward output to parent

			if (!detectedPort) {
				detectedPort = detectPortFromOutput(chunk)
				if (detectedPort) {
					clearTimeout(timeout)
					console.log(chalk.green(`✅ Detected port: ${detectedPort}`))
					resolve({ process: childProcess, detectedPort })
				}
			}
		}

		childProcess.stdout?.on("data", processOutput)
		childProcess.stderr?.on("data", (data) => {
			const chunk = data.toString()
			output += chunk
			process.stderr.write(chunk) // Forward stderr to parent

			if (!detectedPort) {
				detectedPort = detectPortFromOutput(chunk)
				if (detectedPort) {
					clearTimeout(timeout)
					console.log(chalk.green(`✅ Detected port: ${detectedPort}`))
					resolve({ process: childProcess, detectedPort })
				}
			}
		})

		childProcess.on("error", (error) => {
			clearTimeout(timeout)
			reject(error)
		})

		childProcess.on("exit", (code) => {
			clearTimeout(timeout)
			if (code !== 0 && !detectedPort) {
				reject(new Error(`Command exited with code ${code}`))
			}
		})
	})
}

// Open URL in browser
async function openInBrowser(url: string): Promise<void> {
	try {
		const platform = process.platform
		let command: string

		switch (platform) {
			case "darwin": // macOS
				command = `open "${url}"`
				break
			case "win32": // Windows
				command = `start "" "${url}"`
				break
			default: // Linux and others
				command = `xdg-open "${url}"`
				break
		}

		await execAsync(command)
		console.log(chalk.green("🌐 Opened playground in browser"))
	} catch (error) {
		console.log(chalk.yellow("Could not open browser automatically"))
		console.log(chalk.gray("Please open the link manually"))
	}
}

export async function playground(options: {
	port?: string
	command?: string
	apiKey: string
}): Promise<void> {
	try {
		let finalPort = options.port || "8181"
		let childProcess: ChildProcess | undefined

		// If command is provided, start it and detect port
		if (options.command) {
			const { process: proc, detectedPort } = await startSubprocess(
				options.command,
				finalPort,
			)
			childProcess = proc
			finalPort = detectedPort
		}

		console.log(chalk.blue(`🚀 Starting tunnel for localhost:${finalPort}...`))

		// Get temporary token from Smithery backend
		console.log(chalk.gray("Getting tunnel credentials..."))
		const { authtoken, domain } = await getTemporaryTunnelToken(options.apiKey)

		// Start tunnel using ngrok SDK with temporary token
		const listener = await ngrok.forward({
			addr: finalPort,
			authtoken,
			domain,
		})

		const tunnelUrl = listener.url()

		if (!tunnelUrl) {
			throw new Error("Failed to get tunnel URL")
		}

		const playgroundUrl = `https://smithery.ai/playground?mcp=${encodeURIComponent(tunnelUrl)}`

		// Print helpful links
		console.log(chalk.cyan(`🔗 Playground: ${playgroundUrl}`))
		console.log(chalk.gray("Press Ctrl+C to stop the tunnel"))

		// Open playground in browser
		await openInBrowser(playgroundUrl)

		// Handle cleanup on exit
		const cleanup = async () => {
			console.log(chalk.yellow("\n👋 Shutting down tunnel..."))

			// Close tunnel
			try {
				await listener.close()
				console.log(chalk.green("Tunnel closed"))
			} catch (error) {
				console.log(chalk.yellow("Tunnel already closed"))
			}

			// Kill child process if it exists
			if (childProcess && !childProcess.killed) {
				console.log(chalk.yellow("Stopping subprocess..."))
				childProcess.kill("SIGTERM")

				// Force kill after 5 seconds
				setTimeout(() => {
					if (childProcess && !childProcess.killed) {
						childProcess.kill("SIGKILL")
					}
				}, 5000)
			}

			process.exit(0)
		}

		// Set up signal handlers before keeping process alive
		process.on("SIGINT", cleanup)
		process.on("SIGTERM", cleanup)

		// If child process exits, also exit (only if we have a child process)
		if (childProcess) {
			childProcess.on("exit", (code) => {
				console.log(chalk.yellow(`\nSubprocess exited with code ${code}`))
				cleanup()
			})
		}

		// Keep the process alive by keeping stdin open
		process.stdin.resume()

		// Keep the process alive indefinitely (this promise never resolves)
		await new Promise<void>(() => {})
	} catch (error) {
		console.error(chalk.red("Error:"), error)
		process.exit(1)
	}
}
