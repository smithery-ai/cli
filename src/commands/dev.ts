import { type ChildProcess, spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import chalk from "chalk"
import { DEFAULT_PORT } from "../constants"
import { buildMcpServer } from "../lib/build"
import { setupTunnelAndPlayground } from "../lib/dev-lifecycle"
import { debug } from "../lib/logger"
import { ensureApiKey } from "../utils/runtime"

interface DevOptions {
	entryFile?: string
	port?: string
	key?: string
	open?: boolean
	initialMessage?: string
	configFile?: string
}

export async function dev(options: DevOptions = {}): Promise<void> {
	try {
		// Ensure API key is available
		const apiKey = await ensureApiKey(options.key)

		const smitheryDir = join(".smithery")
		const outFile = join(smitheryDir, "index.cjs")
		const finalPort = options.port || DEFAULT_PORT.toString()

		let childProcess: ChildProcess | undefined
		let tunnelListener: { close: () => Promise<void> } | undefined
		let isFirstBuild = true
		let isRebuilding = false

		// Function to start the server process
		const startServer = async () => {
			// Kill existing process
			if (childProcess && !childProcess.killed) {
				isRebuilding = true
				childProcess.kill("SIGTERM")
				await new Promise((resolve) => setTimeout(resolve, 100))
			}

			// Ensure the output file exists before starting the process (handles async fs write timing)
			await new Promise<void>((resolve) => {
				if (existsSync(outFile)) {
					return resolve()
				}
				const interval = setInterval(() => {
					if (existsSync(outFile)) {
						clearInterval(interval)
						resolve()
					}
				}, 50)
			})

			// Start new process with tsx loader so .ts imports work in runtime bootstrap
			childProcess = spawn(
				"node",
				["--import", "tsx", join(process.cwd(), outFile)],
				{
					stdio: ["inherit", "pipe", "pipe"],
					env: {
						...process.env,
						PORT: finalPort,
					},
				},
			)

			const processOutput = (data: Buffer) => {
				const chunk = data.toString()
				process.stdout.write(chunk)
			}

			childProcess.stdout?.on("data", processOutput)
			childProcess.stderr?.on("data", (data) => {
				const chunk = data.toString()
				process.stderr.write(chunk)
			})

			childProcess.on("error", (error) => {
				console.error(chalk.red("❌ Process error:"), error)
				cleanup()
			})

			childProcess.on("exit", (code) => {
				// Ignore exits during rebuilds - this is expected behavior
				if (isRebuilding) {
					isRebuilding = false
					return
				}

				if (code !== 0 && code !== null) {
					console.log(chalk.yellow(`⚠️  Process exited with code ${code}`))
					cleanup()
				}
			})

			// Start tunnel and open playground on first successful start
			if (isFirstBuild) {
				console.log(chalk.green(`✅ Server starting on port ${finalPort}`))
				setupTunnelAndPlayground(
					finalPort,
					apiKey,
					options.open !== false,
					options.initialMessage,
				)
					.then(({ listener }) => {
						tunnelListener = listener
						isFirstBuild = false
					})
					.catch((error) => {
						console.error(chalk.red("❌ Failed to start tunnel:"), error)
					})
			}
		}

		// Set up build with watch mode
		const buildContext = await buildMcpServer({
			outFile,
			entryFile: options.entryFile,
			configFile: options.configFile,
			watch: true,
			onRebuild: () => {
				startServer()
			},
		})

		// Handle cleanup on exit
		const cleanup = async () => {
			console.log(chalk.yellow("\n👋 Shutting down dev server..."))

			// Stop watching
			if (buildContext && "dispose" in buildContext) {
				await buildContext.dispose()
			}

			// Close tunnel
			if (tunnelListener) {
				try {
					await tunnelListener.close()
					debug(chalk.green("Tunnel closed"))
				} catch (_error) {
					debug(chalk.yellow("Tunnel already closed"))
				}
			}

			// Kill child process
			if (childProcess && !childProcess.killed) {
				console.log(chalk.yellow("Stopping MCP server..."))
				console.log(
					`\n\n${chalk.rgb(
						234,
						88,
						12,
					)(
						"Thanks for using Smithery!",
					)}\n🚀 One-click cloud deploy: ${chalk.blue.underline(
						"https://smithery.ai/new",
					)}\n\n`,
				)

				// Wait for process to exit after sending SIGTERM
				const processExited = new Promise<void>((resolve) => {
					if (childProcess) {
						childProcess.on('exit', () => resolve())
					} else {
						resolve()
					}
				})

				childProcess.kill("SIGTERM")

				// Race between graceful exit and force kill
				const forceKill = new Promise<void>((resolve) => {
					setTimeout(() => {
						if (childProcess && !childProcess.killed) {
							childProcess.kill("SIGKILL")
						}
						resolve()
					}, 5000)
				})

				// Wait for either graceful exit or force kill timeout
				await Promise.race([processExited, forceKill])
			}

			process.exit(0)
		}

		// Set up signal handlers
		process.on("SIGINT", cleanup)
		process.on("SIGTERM", cleanup)

		// Keep the process alive
		await new Promise<void>(() => {})
	} catch (error) {
		console.error(chalk.red("❌ Dev server failed:"), error)
		process.exit(1)
	}
}
