import { existsSync, mkdirSync, statSync } from "node:fs"
import { dirname } from "node:path"
import chalk from "chalk"
import * as esbuild from "esbuild"
import { resolveEntryPoint } from "./config-loader.js"

// TypeScript declarations for global constants injected at build time
declare const __SMITHERY_VERSION__: string
declare const __SHTTP_BOOTSTRAP__: string
declare const __STDIO_BOOTSTRAP__: string

type BaseBuildOptions = {
	entryFile?: string
	outFile?: string
	watch?: boolean
	onRebuild?: (success: boolean, outputs: string[]) => void
	minify?: boolean
	sourceMaps?: boolean
}

/**
 * Build options with compile-time validation for bundle mode constraints.
 *
 */
export type BuildOptions =
	| (BaseBuildOptions & {
			// shttp transport: uses user-module (no bootstrap wrapper needed)
			production?: boolean
			transport?: "shttp"
			bundleMode?: "user-module"
	  })
	| (BaseBuildOptions & {
			// stdio transport + scanning: allows user-module (imports module for scanning)
			production: false
			transport: "stdio"
			bundleMode?: "bootstrap" | "user-module"
	  })
	| (BaseBuildOptions & {
			// stdio transport + executable: requires bootstrap (handles CLI parsing & transport)
			production?: true
			transport: "stdio"
			bundleMode?: "bootstrap"
	  })

/**
 * Build MCP server using esbuild
 */
async function esbuildServer(
	options: BuildOptions,
	entryFile: string,
): Promise<esbuild.BuildContext | esbuild.BuildResult> {
	const startTime = performance.now()
	const transport = options.transport || "shttp"

	// shttp = workerd (ESM), stdio = Node.js (CJS with bootstrap)
	const isStdio = transport === "stdio"
	const defaultOutFile = isStdio
		? ".smithery/index.cjs"
		: ".smithery/bundle/module.js"
	const outFile = options.outFile || defaultOutFile

	// Create output directory if it doesn't exist
	const outDir = dirname(outFile)
	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true })
	}

	const transportDisplay = isStdio ? "stdio" : "shttp"

	console.log(
		chalk.dim(
			`${chalk.bold.italic.hex("#ea580c")("SMITHERY")} ${chalk.bold.italic.hex("#ea580c")(`v${__SMITHERY_VERSION__}`)} Building MCP server for ${chalk.cyan(transportDisplay)}...`,
		),
	)

	// Create a bootstrap plugin for the given transport
	const createBootstrapPlugin = (type: "stdio" | "shttp"): esbuild.Plugin => ({
		name: "smithery-bootstrap-plugin",
		setup(build: esbuild.PluginBuild) {
			build.onResolve({ filter: /^virtual:bootstrap$/ }, () => ({
				path: "virtual:bootstrap",
				namespace: "bootstrap",
			}))

			build.onLoad({ filter: /.*/, namespace: "bootstrap" }, () => {
				const bootstrapSource =
					type === "stdio" ? __STDIO_BOOTSTRAP__ : __SHTTP_BOOTSTRAP__

				// Replace the user-module import with the actual entry file
				const pattern = /from\s*["']virtual:user-module["']/g

				const modifiedBootstrap = bootstrapSource.replace(
					pattern,
					`from ${JSON.stringify(entryFile)}`,
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
	const shouldMinify = options.minify ?? options.production ?? false
	const bundleMode = options.bundleMode ?? "bootstrap"
	// Use bootstrap unless explicitly set to user-module mode
	const useBootstrap = bundleMode === "bootstrap"

	const buildConfig: esbuild.BuildOptions = {
		bundle: true,
		outfile: outFile,
		minify: shouldMinify,
		sourcemap: options.sourceMaps ?? !shouldMinify,
		entryPoints: useBootstrap ? ["virtual:bootstrap"] : [entryFile],
		plugins: useBootstrap ? [createBootstrapPlugin(transport)] : [],
		define: {
			"process.env.NODE_ENV": JSON.stringify(
				options.production ? "production" : "development",
			),
		},
		...(isStdio
			? {
					// stdio: Node.js CJS bundle with bootstrap
					platform: "node",
					target: "node20",
					format: "cjs",
				}
			: {
					// shttp: workerd ESM bundle with Node.js compat
					platform: "node",
					target: "esnext",
					format: "esm",
					conditions: ["workerd", "worker", "browser"],
				}),
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
			const relativePath = outFile.replace(`${process.cwd()}/`, "")
			const bytes = stats.size
			const fileSize =
				bytes < 1024
					? `${bytes} B`
					: bytes < 1024 * 1024
						? `${(bytes / 1024).toFixed(2)} KB`
						: `${(bytes / (1024 * 1024)).toFixed(2)} MB`
			const buildMode = shouldMinify ? "" : " (not minified)"
			console.log(
				`\n  ${relativePath}  ${chalk.yellow(fileSize)}  ${chalk.gray("(entry point)")}${buildMode}\n`,
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
	return await esbuildServer(options, entryFile)
}
