import chalk from "chalk"
import * as esbuild from "esbuild"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { spawn, type ChildProcess } from "node:child_process"
import { detectPortFromOutput } from "../lib/tunnel"
import { setupTunnelAndPlayground } from "../lib/dev-lifecycle"
import { ensureApiKey } from "../utils/runtime"
import { pathToFileURL } from "node:url"

interface DevOptions {
	port?: string
	key?: string
	open?: boolean
}

export async function dev(options: DevOptions = {}): Promise<void> {
	try {
		// Ensure API key is available
		const apiKey = await ensureApiKey(options.key)

		// Check if src/index.ts exists
		const entryFile = join("src/index.ts")
		const entryPathAbs = join(process.cwd(), entryFile)
		// Use absolute file URL so Node can resolve with loader
		const entryFileUrl = pathToFileURL(entryPathAbs).href
		if (!existsSync(entryPathAbs)) {
			console.error(
				chalk.red(
					"❌ Could not find src/index.ts with a default MCP server export.\n" +
						"Please create src/index.ts that exports a function to create an MCP server.",
				),
			)
			process.exit(1)
		}

		// Create .smithery directory if it doesn't exist
		const smitheryDir = join(".smithery")
		if (!existsSync(smitheryDir)) {
			const fs = await import("node:fs")
			fs.mkdirSync(smitheryDir, { recursive: true })
		}

		const outFile = join(smitheryDir, "dev.cjs")
		// Dynamically resolve bootstrap path for both src (dev) and dist (prod) builds
		let bootstrapPath = ""
		const candidatePaths = [
			join(__dirname, "../runtime/dev-bootstrap.ts"),
			join(__dirname, "../runtime/dev-bootstrap.js"),
			join(__dirname, "../src/runtime/dev-bootstrap.ts"),
		]
		for (const candidate of candidatePaths) {
			if (existsSync(candidate)) {
				bootstrapPath = candidate
				break
			}
		}
		if (!bootstrapPath) {
			console.error(
				chalk.red(
					"❌ Could not locate dev-bootstrap.ts. Please reinstall the Smithery CLI.",
				),
			)
			process.exit(1)
		}

		console.log(chalk.blue("🔨 Building MCP server..."))

		// Set up esbuild with watch mode and rebuild plugin
		const buildContext = await esbuild.context({
			entryPoints: [entryFile],
			bundle: true,
			platform: "node",
			target: "node20",
			outfile: outFile,
			sourcemap: "inline",
			format: "cjs",
			inject: [bootstrapPath],
			define: {
				__SMITHERY_ENTRY__: JSON.stringify(entryFileUrl),
			},
			external: ["@modelcontextprotocol/sdk", "@smithery/sdk"],
			plugins: [
				{
					name: "rebuild-handler",
					setup(build) {
						let serverStarted = false
						build.onEnd((result) => {
							if (result.errors.length > 0) {
								console.error(chalk.red("❌ Build error:"), result.errors)
								return
							}
							if (!serverStarted) {
								console.log(chalk.green("✅ Initial build complete"))
							} else {
								console.log(chalk.green("✅ Rebuilt successfully"))
							}
							startServer()
							serverStarted = true
						})
					},
				},
			],
		})

		let childProcess: ChildProcess | undefined
		let detectedPort: string | undefined
		let tunnelListener: { close: () => Promise<void> } | undefined
		let isFirstBuild = true

		// Function to start the server process
		const startServer = async () => {
			// Kill existing process
			if (childProcess && !childProcess.killed) {
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
						PORT: options.port || "8181",
					},
				},
			)

			let output = ""
			const timeout = setTimeout(() => {
				if (!detectedPort) {
					console.error(
						chalk.red("❌ Timeout: Could not detect port from server output"),
					)
				}
			}, 10000) // 10 second timeout

			const processOutput = (data: Buffer) => {
				const chunk = data.toString()
				output += chunk
				process.stdout.write(chunk)

				if (!detectedPort) {
					const port = detectPortFromOutput(chunk)
					if (port) {
						detectedPort = port
						clearTimeout(timeout)
						console.log(chalk.green(`✅ Detected port: ${detectedPort}`))

						// Start tunnel and open playground on first successful start
						if (isFirstBuild) {
							setupTunnelAndPlayground(
								detectedPort,
								apiKey,
								options.open !== false,
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
				}
			}

			childProcess.stdout?.on("data", processOutput)
			childProcess.stderr?.on("data", (data) => {
				const chunk = data.toString()
				output += chunk
				process.stderr.write(chunk)

				if (!detectedPort) {
					const port = detectPortFromOutput(chunk)
					if (port) {
						detectedPort = port
						clearTimeout(timeout)
						console.log(chalk.green(`✅ Detected port: ${detectedPort}`))
					}
				}
			})

			childProcess.on("error", (error) => {
				console.error(chalk.red("❌ Process error:"), error)
				cleanup()
			})

			childProcess.on("exit", (code) => {
				if (code !== 0) {
					console.log(chalk.yellow(`⚠️  Process exited with code ${code}`))
					cleanup()
				}
			})
		}

		// Start watching for changes (initial build will trigger plugin handler)
		await buildContext.watch()

		// Handle cleanup on exit
		const cleanup = async () => {
			console.log(chalk.yellow("\n👋 Shutting down dev server..."))

			// Stop watching
			await buildContext.dispose()

			// Close tunnel
			if (tunnelListener) {
				try {
					await tunnelListener.close()
					console.log(chalk.green("Tunnel closed"))
				} catch (error) {
					console.log(chalk.yellow("Tunnel already closed"))
				}
			}

			// Kill child process
			if (childProcess && !childProcess.killed) {
				console.log(chalk.yellow("Stopping MCP server..."))
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
