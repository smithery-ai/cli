import { type ChildProcess, spawn } from "node:child_process"
import { existsSync, watch as fsWatch } from "node:fs"
import { join } from "node:path"
import chalk from "chalk"
import { DEFAULT_PORT } from "../constants"
import { buildServer } from "../lib/build"
import { isWidgetProject } from "../lib/config"
import { setupTunnelAndPlayground } from "../lib/dev-lifecycle"
import { debug } from "../lib/logger"
import { buildWidgets } from "../lib/widget/widget-bundler"
import { discoverWidgets } from "../lib/widget/widget-discovery"
import { validateWidgetProject } from "../lib/widget/widget-validation"
import { cleanupChildProcess } from "../utils/child-process-cleanup"
import { setupProcessLifecycle } from "../utils/process-lifecycle"
import { ensureApiKey } from "../utils/runtime"

interface DevOptions {
	entryFile?: string
	port?: string
	key?: string
	tunnel?: boolean
	open?: boolean
	initialMessage?: string
	configFile?: string
	minify?: boolean
}

export async function dev(options: DevOptions = {}): Promise<void> {
	try {
		// Validate widget project structure if applicable
		if (isWidgetProject()) {
			validateWidgetProject()
		}

		// Ensure API key is available
		const apiKey = await ensureApiKey(options.key)

		const smitheryDir = join(".smithery")
		const outFile = join(smitheryDir, "index.cjs")
		const finalPort = options.port || DEFAULT_PORT.toString()
		const shouldSetupTunnel = options.tunnel !== false

		let childProcess: ChildProcess | undefined
		let tunnelListener: { close: () => Promise<void> } | undefined
		let isFirstBuild = true
		let isRebuilding = false
		let widgetWatcher: ReturnType<typeof fsWatch> | undefined

		// Function to start the server process
		const startServer = async () => {
			const startTime = Date.now()

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

			// Display the actual command being executed on first start
			if (isFirstBuild) {
				const relativeOutFile = join(process.cwd(), outFile).replace(
					`${process.cwd()}/`,
					"",
				)
				const commandStr = `node ${relativeOutFile}`
				console.log(chalk.dim(`$ ${commandStr}`))
			}

			// Start new process with Node
			childProcess = spawn("node", [join(process.cwd(), outFile)], {
				stdio: ["inherit", "pipe", "pipe"],
				env: {
					...process.env,
					PORT: finalPort,
					FORCE_COLOR: "1", // Enable chalk colors even when piped
					LOG_LEVEL: process.env.LOG_LEVEL || "debug", // Default to debug in dev mode
				},
			})

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
				console.log(
					chalk.dim(`> Server starting on port ${chalk.green(finalPort)}`),
				)
				if (shouldSetupTunnel) {
					setupTunnelAndPlayground(
						finalPort,
						apiKey,
						options.open !== false,
						options.initialMessage,
					)
						.then(({ listener }) => {
							const _startupTime = Date.now() - startTime
							// console.log(chalk.dim(`⚡ Server startup completed in ${startupTime}ms`))
							tunnelListener = listener
							isFirstBuild = false
						})
						.catch((error) => {
							console.error(chalk.red("❌ Failed to start tunnel:"), error)
						})
				} else {
					isFirstBuild = false
				}
			}
		}

		// Set up build with watch mode
		const buildContext = await buildServer({
			outFile,
			entryFile: options.entryFile,
			configFile: options.configFile,
			watch: true,
			minify: options.minify,
			onRebuild: () => {
				startServer()
			},
		})

		// Set up widget watching if this is a widget project
		if (isWidgetProject()) {
			const widgets = discoverWidgets()

			if (widgets.length > 0) {
				// Build widgets initially
				await buildWidgets(widgets, { production: false, minify: options.minify })

				// Watch for changes in app/web/src
				const webSrcDir = join(process.cwd(), "app/web/src")
				if (existsSync(webSrcDir)) {
					let rebuildTimeout: NodeJS.Timeout | undefined

					widgetWatcher = fsWatch(
						webSrcDir,
						{ recursive: true },
						async (_eventType, filename) => {
							if (!filename || !filename.endsWith(".tsx")) {
								return
							}

							// Debounce rebuilds
							if (rebuildTimeout) {
								clearTimeout(rebuildTimeout)
							}

							rebuildTimeout = setTimeout(async () => {
								console.log(chalk.dim(`\n📦 Widget file changed: ${filename}`))
								const currentWidgets = discoverWidgets()
								await buildWidgets(currentWidgets, { production: false, minify: options.minify })
								console.log(chalk.green("✓ Widgets rebuilt"))
							}, 100)
						},
					)

					console.log(chalk.dim("👀 Watching for widget changes..."))
				}
			}
		}

		// Handle cleanup on exit
		const cleanup = async () => {
			console.log(chalk.yellow("\no/ Shutting down server..."))

			// Stop watching
			if (buildContext && "dispose" in buildContext) {
				await buildContext.dispose()
			}

			// Stop widget watcher
			if (widgetWatcher) {
				widgetWatcher.close()
			}

			// Kill child process
			if (childProcess) {
				await cleanupChildProcess({
					childProcess,
					processName: "server",
				})
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
		}

		// Set up process lifecycle management
		setupProcessLifecycle({
			cleanupFn: cleanup,
			processName: "server",
		})
	} catch (error) {
		console.error(chalk.red("❌ Dev server failed:"), error)
		process.exit(1)
	}
}
