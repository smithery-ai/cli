import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import chalk from "chalk"
import * as esbuild from "esbuild"
import { formatFileSize } from "../utils/build"

// TypeScript declarations for global constants injected at build time
declare const __SMITHERY_SHTTP_BOOTSTRAP__: string
declare const __SMITHERY_STDIO_BOOTSTRAP__: string

export type BuildResult = {
	success: boolean
	outputs?: string[]
	errors?: string[]
	logs?: string[]
}

export interface BuildOptions {
	entryFile?: string
	outFile?: string
	watch?: boolean
	onRebuild?: (success: boolean, outputs: string[]) => void
	production?: boolean
	transport?: "shttp" | "stdio"
	configFile?: string
	buildTool?: "esbuild" | "bun"
}

/**
 * Resolves the entry point from package.json or uses provided entryFile
 */
function resolveEntryPoint(providedEntry?: string): string {
	if (providedEntry) {
		const resolvedPath = resolve(process.cwd(), providedEntry)
		if (!existsSync(resolvedPath)) {
			throw new Error(`Entry file not found at ${resolvedPath}`)
		}
		return resolvedPath
	}

	// Read package.json to find entry point
	const packageJsonPath = join(process.cwd(), "package.json")
	if (!existsSync(packageJsonPath)) {
		throw new Error(
			"No package.json found in current directory. Please run this command from your project root or specify an entry file.",
		)
	}

	let packageJson: Record<string, unknown>
	try {
		const packageContent = readFileSync(packageJsonPath, "utf-8")
		packageJson = JSON.parse(packageContent)
	} catch (error) {
		throw new Error(`Failed to parse package.json: ${error}`)
	}

	// Check "module" field (TypeScript entry point)
	if (!packageJson.module || typeof packageJson.module !== "string") {
		throw new Error(
			'No entry point found in package.json. Please define the "module" field:\n' +
				'  "module": "./src/index.ts"\n' +
				"Or specify an entry file directly with the command.",
		)
	}

	const entryPoint = packageJson.module
	const resolvedPath = resolve(process.cwd(), entryPoint)
	if (!existsSync(resolvedPath)) {
		throw new Error(
			`Entry file specified in package.json not found at ${resolvedPath}.
Check that the file exists or update your package.json`,
		)
	}

	return resolvedPath
}

/**
 * Load custom build configuration from file
 */
async function loadCustomConfig(
	configPath?: string,
	buildTool: "esbuild" | "bun" = "esbuild",
): Promise<Record<string, unknown>> {
	const possiblePaths = configPath
		? [configPath]
		: ["smithery.config.js", "smithery.config.mjs", "smithery.config.cjs"]

	for (const path of possiblePaths) {
		const resolvedPath = resolve(process.cwd(), path)
		if (existsSync(resolvedPath)) {
			try {
				// Use dynamic import to support both ESM and CJS
				const config = await import(resolvedPath)
				return config.default?.[buildTool] || config[buildTool] || {}
			} catch (error) {
				console.warn(`Failed to load config from ${path}:`, error)
			}
		}
	}

	return {}
}

/**
 * Analyze entry file to determine if it's stateless or stateful
 */
async function detectServerType(
	entryFile: string,
): Promise<"stateless" | "stateful"> {
	try {
		// Dynamically import the module to check its exports
		const module = await import(entryFile)
		return module.stateless === true ? "stateless" : "stateful"
	} catch {
		return "stateful" // Default fallback
	}
}

/**
 * Create bootstrap code for build tools
 */
function createBootstrapCode(
	entryFile: string,
	transport: "shttp" | "stdio",
): string {
	// Get the bootstrap code
	const bootstrapCode =
		transport === "stdio"
			? __SMITHERY_STDIO_BOOTSTRAP__
			: __SMITHERY_SHTTP_BOOTSTRAP__

	return bootstrapCode.replace(
		'import * as _entry from "virtual:user-module"',
		`import * as _entry from ${JSON.stringify(entryFile)}`,
	)
}

/**
 * Build MCP server using Bun
 */
async function bunServer(
	options: BuildOptions,
	entryFile: string,
	serverType: string,
): Promise<BuildResult> {
	const startTime = performance.now()
	const outFile = options.outFile || ".smithery/index.js"
	const transport = options.transport ?? "shttp"

	// Create output directory if it doesn't exist
	const outDir = dirname(outFile)
	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true })
	}

	const transportDisplay = transport === "shttp" ? "streamable http" : transport
	console.log(
		`* Building ${chalk.cyan(serverType)} MCP server with ${chalk.cyan(transportDisplay)} transport...`,
	)

	// Create temporary bootstrap file
	const tempBootstrap = resolve(process.cwd(), "temp-bootstrap.ts")
	const bootstrapCode = createBootstrapCode(entryFile, transport)

	// Write bootstrap to temp file
	const fs = await import("node:fs/promises")
	await fs.writeFile(tempBootstrap, bootstrapCode)

	try {
		// Load custom config
		const customConfig = await loadCustomConfig(options.configFile, "bun")

		// Common build options
		const buildConfig = {
			entrypoints: [tempBootstrap],
			outdir: dirname(outFile),
			target: "node" as const,
			minify: options.production ?? true,
			sourcemap: "external" as const,
			naming: {
				entry: `${require("node:path").basename(outFile, ".js")}.[ext]`,
			},
			define: {
				"process.env.NODE_ENV": JSON.stringify(
					options.production ? "production" : "development",
				),
			},
			...customConfig,
		}

		if (options.watch && options.onRebuild) {
			console.log(chalk.dim(chalk.blue("Starting build in watch mode...")))

			// Use filesystem watcher (Bun's native watchers when running on Bun, Node.js fs.watch otherwise)
			// NOTE: Bun.build() doesn't have native watch mode yet (https://github.com/oven-sh/bun/issues/5866)
			// This manual approach is the recommended workaround until native support lands
			const { watch } = await import("node:fs/promises")

			let isBuilding = false

			const doBuild = async () => {
				if (isBuilding) return
				isBuilding = true

				try {
					const result = await Bun.build(buildConfig)

					if (result.success) {
						const outputs = result.outputs.map(
							(o: unknown) => (o as { path: string }).path,
						)
						console.log(chalk.green("✓ Rebuilt successfully"))
						options.onRebuild?.(true, outputs)
					} else {
						console.error(chalk.red("✗ Build error:"), result.logs)
						options.onRebuild?.(false, [])
					}
				} catch (error) {
					console.error(chalk.red("✗ Build error:"), error)
					options.onRebuild?.(false, [])
				} finally {
					isBuilding = false
				}
			}

			// Initial build
			await doBuild()

			// Watch for changes using async iterator pattern
			const watcher = watch(dirname(entryFile), { recursive: true })

			// Handle cleanup on SIGINT
			let shouldStop = false
			process.on("SIGINT", () => {
				shouldStop = true
				console.log("\nClosing watcher...")
				process.exit(0)
			})

			// Watch for file changes using async iterator
			;(async () => {
				try {
					for await (const event of watcher) {
						if (shouldStop) break

						if (
							event.filename &&
							(event.filename.endsWith(".ts") || event.filename.endsWith(".js"))
						) {
							console.log(
								chalk.blue(`File ${event.filename} changed, rebuilding...`),
							)
							doBuild()
						}
					}
				} catch (error) {
					if (!shouldStop) {
						console.error("Watcher error:", error)
					}
				}
			})()

			return { success: true }
		} else {
			// Single build
			try {
				const result = await Bun.build(buildConfig)

				if (result.success) {
					const endTime = performance.now()
					const duration = Math.round(endTime - startTime)
					const outputs = result.outputs.map(
						(o: unknown) => (o as { path: string }).path,
					)

					console.log(
						chalk.green(`✓ Built ${serverType} MCP server in ${duration}ms`),
					)

					// Display file size info for the main output
					if (outputs.length > 0 && existsSync(outputs[0])) {
						const stats = statSync(outputs[0])
						const _fileName = basename(outputs[0])
						const relativePath = outputs[0].replace(`${process.cwd()}/`, "")
						const fileSize = formatFileSize(stats.size)
						console.log(
							`\n  ${relativePath}  ${chalk.yellow(fileSize)}  ${chalk.gray("(entry point)")}\n`,
						)
					}

					return { success: true, outputs }
				} else {
					console.log(chalk.red("✗ Build failed"))
					const logs = result.logs?.map((log: unknown) => String(log)) || []
					for (const log of logs) {
						console.error(log)
					}
					process.exit(1)
				}
			} catch (error) {
				console.log(chalk.red("✗ Build failed"))
				console.error(error)
				process.exit(1)
			}
		}
	} finally {
		// Clean up temp file
		try {
			const fs = await import("node:fs/promises")
			await fs.unlink(tempBootstrap)
		} catch {
			// Ignore cleanup errors
		}
	}

	return { success: false }
}

/**
 * Build MCP server using esbuild
 */
async function esbuildServer(
	options: BuildOptions,
	entryFile: string,
	serverType: string,
): Promise<esbuild.BuildContext | esbuild.BuildResult> {
	const startTime = performance.now()
	const outFile = options.outFile || ".smithery/index.js"
	const transport = options.transport ?? "shttp"

	// Create output directory if it doesn't exist
	const outDir = dirname(outFile)
	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true })
	}

	const transportDisplay = transport === "shttp" ? "streamable http" : transport
	console.log(
		`* Building ${chalk.cyan(serverType)} MCP server with ${chalk.cyan(transportDisplay)} transport...`,
	)

	// Create a unified plugin that handles both dev and production
	const createBootstrapPlugin = (): esbuild.Plugin => ({
		name: "smithery-bootstrap-plugin",
		setup(build) {
			build.onResolve({ filter: /^virtual:bootstrap$/ }, () => ({
				path: "virtual:bootstrap",
				namespace: "bootstrap",
			}))

			build.onLoad({ filter: /.*/, namespace: "bootstrap" }, () => {
				// Get the bootstrap code
				const bootstrapCode =
					transport === "stdio"
						? __SMITHERY_STDIO_BOOTSTRAP__
						: __SMITHERY_SHTTP_BOOTSTRAP__

				const modifiedBootstrap = bootstrapCode.replace(
					'import * as _entry from "virtual:user-module"',
					`import * as _entry from ${JSON.stringify(entryFile)}`,
				)

				return {
					contents: modifiedBootstrap,
					loader: "js",
					resolveDir: dirname(entryFile),
				}
			})
		},
	})

	// Common build options
	const commonOptions: esbuild.BuildOptions = {
		bundle: true,
		platform: "node",
		target: "node20",
		outfile: outFile,
		minify: options.production ?? true,
		sourcemap: "inline",
		format: "esm",
		banner: {
			js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
		},
	}

	let buildConfig: esbuild.BuildOptions

	buildConfig = {
		...commonOptions,
		entryPoints: ["virtual:bootstrap"],
		plugins: [createBootstrapPlugin()],
		define: {
			"process.env.NODE_ENV": JSON.stringify(
				options.production ? "production" : "development",
			),
		},
	}

	// Load custom config
	const customConfig = await loadCustomConfig(options.configFile, "esbuild")
	buildConfig = { ...buildConfig, ...(customConfig as esbuild.BuildOptions) }

	if (options.watch && options.onRebuild) {
		// Set up esbuild with watch mode and rebuild plugin
		const plugins: esbuild.Plugin[] = [
			...(buildConfig.plugins || []),
			{
				name: "rebuild-handler",
				setup(build) {
					let serverStarted = false
					build.onEnd((result) => {
						if (result.errors.length > 0) {
							console.error(chalk.red("✗ Build error:"), result.errors)
							options.onRebuild?.(false, [])
							return
						}
						if (!serverStarted) {
							console.log(chalk.green("✓ Initial build complete"))
						} else {
							console.log(chalk.green("✓ Rebuilt successfully"))
						}
						const outputs = result.outputFiles?.map((f) => f.path) || [outFile]
						options.onRebuild?.(true, outputs)
						serverStarted = true
					})
				},
			},
		]

		const buildContext = await esbuild.context({ ...buildConfig, plugins })
		await buildContext.watch()
		return buildContext
	}

	// Single build
	try {
		const result = await esbuild.build(buildConfig)
		if (result.errors.length > 0) {
			console.log(chalk.red("✗ Build failed"))
			console.error(result.errors)
			process.exit(1)
		}

		const endTime = performance.now()
		const duration = Math.round(endTime - startTime)
		console.log(
			chalk.green(`✓ Built ${serverType} MCP server in ${duration}ms`),
		)

		// Display file size info for the output file
		if (existsSync(outFile)) {
			const stats = statSync(outFile)
			// const fileName = basename(outFile)
			const relativePath = outFile.replace(`${process.cwd()}/`, "")
			const fileSize = formatFileSize(stats.size)
			console.log(
				`\n  ${relativePath}  ${chalk.yellow(fileSize)}  ${chalk.gray("(entry point)")}\n`,
			)
		}

		return result
	} catch (error) {
		console.log(chalk.red("✗ Build failed"))
		console.error(error)
		process.exit(1)
	}
}

export async function buildServer(
	options: BuildOptions = {},
): Promise<esbuild.BuildContext | esbuild.BuildResult | BuildResult> {
	const buildTool = options.buildTool || "esbuild"
	const entryFile = resolveEntryPoint(options.entryFile)
	const serverType = await detectServerType(entryFile)

	// Route to appropriate build implementation
	if (buildTool === "bun") {
		return await bunServer(options, entryFile, serverType)
	} else {
		return await esbuildServer(options, entryFile, serverType)
	}
}
