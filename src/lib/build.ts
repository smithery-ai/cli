import chalk from "chalk"
import * as esbuild from "esbuild"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

// TypeScript declarations for global constants injected at build time
declare const __SMITHERY_SHTTP_BOOTSTRAP__: string
declare const __SMITHERY_STDIO_BOOTSTRAP__: string

export interface BuildOptions {
	entryFile?: string
	outFile?: string
	watch?: boolean
	onRebuild?: (result: esbuild.BuildResult) => void
	production?: boolean
	transport?: "shttp" | "stdio"
	configFile?: string // Path to config file
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
 * Load custom esbuild configuration from file
 */
async function loadCustomConfig(
	configPath?: string,
): Promise<Partial<esbuild.BuildOptions>> {
	const possiblePaths = configPath
		? [configPath]
		: ["smithery.config.js", "smithery.config.mjs", "smithery.config.cjs"]

	for (const path of possiblePaths) {
		const resolvedPath = resolve(process.cwd(), path)
		if (existsSync(resolvedPath)) {
			try {
				// Use dynamic import to support both ESM and CJS
				const config = await import(resolvedPath)
				return config.default?.esbuild || config.esbuild || {}
			} catch (error) {
				console.warn(`Failed to load config from ${path}:`, error)
			}
		}
	}

	return {}
}

export async function buildMcpServer(
	options: BuildOptions = {},
): Promise<esbuild.BuildContext | esbuild.BuildResult> {
	const outFile = options.outFile || ".smithery/index.cjs"
	const transport = options.transport ?? "shttp"
	const entryFile = resolveEntryPoint(options.entryFile)

	// Create output directory if it doesn't exist
	const outDir = dirname(outFile)
	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true })
	}

	console.log(
		chalk.blue(`🔨 Building MCP server with ${transport} transport...`),
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
					'require("virtual:user-module")',
					`require(${JSON.stringify(entryFile)})`,
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
		sourcemap: "inline",
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
	buildConfig = { ...buildConfig, ...customConfig }

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
							console.error(chalk.red("❌ Build error:"), result.errors)
							return
						}
						if (!serverStarted) {
							console.log(chalk.green("✅ Initial build complete"))
						} else {
							console.log(chalk.green("✅ Rebuilt successfully"))
						}
						options.onRebuild?.(result)
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
	const result = await esbuild.build(buildConfig)
	if (result.errors.length > 0) {
		console.error(chalk.red("❌ Build failed:"), result.errors)
		process.exit(1)
	}
	console.log(chalk.green("✅ Build complete"))
	return result
}
