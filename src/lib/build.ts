import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import chalk from "chalk"
import * as esbuild from "esbuild"
import { formatFileSize } from "../utils/build"
import { isWidgetProject } from "./config"
import { buildWidgets } from "./widget-bundler"
import { discoverWidgets } from "./widget-discovery"
import { validateWidgetProject } from "./widget-validation"

// TypeScript declarations for global constants injected at build time
declare const __SMITHERY_SHTTP_BOOTSTRAP__: string
declare const __SMITHERY_STDIO_BOOTSTRAP__: string
declare const __SMITHERY_VERSION__: string

export interface BuildOptions {
	entryFile?: string
	outFile?: string
	watch?: boolean
	onRebuild?: (success: boolean, outputs: string[]) => void
	production?: boolean
	transport?: "shttp" | "stdio"
	configFile?: string
	bundleAll?: boolean
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

// no-op helper removed after Bun support was dropped

/**
 * Load custom build configuration from file
 */
async function loadCustomConfig(
	configPath?: string,
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
				const cfg = (config.default ?? config) as Record<string, unknown>
				// Prefer tool-specific section if present; otherwise entire object
				const esCfg = (cfg as { esbuild?: Record<string, unknown> }).esbuild
				return (esCfg as Record<string, unknown>) || cfg || {}
			} catch (error) {
				console.warn(`Failed to load config from ${path}:`, error)
			}
		}
	}

	return {}
}

/**
 * Build MCP server using esbuild
 */
async function esbuildServer(
	options: BuildOptions,
	entryFile: string,
): Promise<esbuild.BuildContext | esbuild.BuildResult> {
	const startTime = performance.now()
	const outFile = options.outFile || ".smithery/index.cjs"
	const transport = options.transport ?? "shttp"

	// Create output directory if it doesn't exist
	const outDir = dirname(outFile)
	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true })
	}

	const transportDisplay = transport === "shttp" ? "streamable http" : transport
	console.log(
		chalk.dim(
			`${chalk.bold.italic.hex("#ea580c")("SMITHERY")} ${chalk.bold.italic.hex("#ea580c")(`v${__SMITHERY_VERSION__}`)} Building MCP server with ${chalk.cyan(transportDisplay)} transport...`,
		),
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
		minify: options.production === true,
		sourcemap: options.production ? false : "inline",
		format: "cjs",
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
	const customConfig = await loadCustomConfig(options.configFile)
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
							console.log(chalk.dim(chalk.green("✓ Initial build complete")))
						} else {
							console.log(chalk.dim(chalk.green("✓ Built successfully")))
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
		console.log(chalk.green(`✓ Built MCP server in ${duration}ms`))

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
): Promise<esbuild.BuildContext | esbuild.BuildResult> {
	const entryFile = resolveEntryPoint(options.entryFile)
	
	// Validate widget project structure if applicable
	if (isWidgetProject()) {
		validateWidgetProject()
	}
	
	const serverResult = await esbuildServer(options, entryFile)
	
	// Build widgets if this is a widget project
	if (!options.watch && isWidgetProject()) {
		const widgets = discoverWidgets()
		if (widgets.length > 0) {
			await buildWidgets(widgets, { production: options.production })
		}
	}
	
	return serverResult
}
