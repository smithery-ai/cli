import ngrok from "@ngrok/ngrok"
import chalk from "chalk"
import { spawn, type ChildProcess } from "node:child_process"

async function getTemporaryTunnelToken(apiKey: string): Promise<{
	authtoken: string
	domain?: string
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
function startSubprocess(command: string): Promise<{
	process: ChildProcess
	detectedPort: string
}> {
	return new Promise((resolve, reject) => {
		console.log(chalk.blue(`🔧 Starting: ${command}`))

		const [cmd, ...args] = command.split(/\s+/)
		const childProcess = spawn(cmd, args, {
			stdio: ["inherit", "pipe", "pipe"],
			shell: true,
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

export async function dev(
	port?: string,
	command?: string,
	apiKey?: string,
): Promise<void> {
	try {
		let finalPort = port || "3000"
		let childProcess: ChildProcess | undefined

		// If command is provided, start it and detect port
		if (command) {
			const { process: proc, detectedPort } = await startSubprocess(command)
			childProcess = proc
			finalPort = detectedPort
		}

		console.log(chalk.blue(`🚀 Starting tunnel for localhost:${finalPort}...`))

		// Get temporary token from Smithery backend
		console.log(chalk.gray("Getting tunnel credentials..."))
		const { authtoken, domain } = await getTemporaryTunnelToken(apiKey!)

		console.log(authtoken, domain)
		// Start tunnel using ngrok SDK with temporary token
		const listener = await ngrok.forward({
			addr: finalPort,
			authtoken,
			...(domain && { domain }), // Use reserved domain if provided
		})

		const tunnelUrl = listener.url()

		if (!tunnelUrl) {
			throw new Error("Failed to get tunnel URL")
		}

		// Print helpful links
		console.log(
			chalk.cyan(
				`🔗 Open:  https://smithery.ai/playground?mcp=${encodeURIComponent(tunnelUrl)}`,
			),
		)
		console.log(chalk.gray("Press Ctrl+C to stop the tunnel"))

		// Handle cleanup on exit
		const cleanup = async () => {
			console.log(chalk.yellow("\n👋 Shutting down tunnel..."))

			// Close tunnel
			await listener.close()
			console.log(chalk.green("Tunnel closed"))

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

		// Keep process alive until SIGINT
		process.on("SIGINT", cleanup)
		process.on("SIGTERM", cleanup)

		// If child process exits, also exit
		if (childProcess) {
			childProcess.on("exit", (code) => {
				console.log(chalk.yellow(`\nSubprocess exited with code ${code}`))
				cleanup()
			})
		}

		// Keep alive
		await new Promise(() => {}) // Never resolves, keeps process running
	} catch (error) {
		console.error(chalk.red("❌ Failed to start development tunnel:"), error)
		console.log(
			chalk.yellow("💡 Make sure you have internet connection and try again"),
		)
		console.log(
			chalk.yellow("   If the problem persists, please contact support"),
		)
		process.exit(1)
	}
}
