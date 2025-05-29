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

			build.onResolve({ filter: /^virtual:user-module$/ }, () => ({
				path: "virtual:user-module",
				namespace: "user-module",
			}))

			build.onLoad({ filter: /.*/, namespace: "bootstrap" }, () => {
				return {
					contents:
						transport === "stdio"
							? __SMITHERY_STDIO_BOOTSTRAP__
							: __SMITHERY_SHTTP_BOOTSTRAP__,
					loader: "js",
				}
			})

			build.onLoad({ filter: /.*/, namespace: "user-module" }, async () => {
				// First, compile the user's TypeScript to JavaScript
				const userBuildResult = await esbuild.build({
					...commonOptions,
					entryPoints: [entryFile],
					write: false, // Don't write to disk, get result as string
					sourcemap: false,
				})

				// Get the compiled user code
				const userCompiledCode = userBuildResult.outputFiles[0].text
				return {
					contents: userCompiledCode,
					loader: "js",
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
