import chalk from "chalk"
import * as esbuild from "esbuild"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { pathToFileURL } from "node:url"

export interface BuildOptions {
	entryFile?: string
	outFile?: string
	watch?: boolean
	onRebuild?: (result: esbuild.BuildResult) => void
	production?: boolean
}

function resolveBootstrapPath(name: string): string {
	const candidatePaths = [
		join(__dirname, "../runtime", `${name}.ts`),
		join(__dirname, "../runtime", `${name}.js`),
		join(__dirname, "../src/runtime", `${name}.ts`),
	]
	for (const candidate of candidatePaths) {
		if (existsSync(candidate)) {
			return candidate
		}
	}
	console.error(
		chalk.red(
			`❌ Could not locate ${name}.ts. Please reinstall the Smithery CLI.`,
		),
	)
	process.exit(1)
}

export async function buildMcpServer(
	options: BuildOptions = {},
): Promise<esbuild.BuildContext | esbuild.BuildResult> {
	const outFile = options.outFile || ".smithery/index.cjs"
	const entryFile = join(process.cwd(), "src/index.ts")

	// Check if the entry file exists
	if (!existsSync(entryFile)) {
		console.error(
			chalk.red(
				`❌ Entry file not found: ${entryFile}. Make sure you have a src/index.ts file.`,
			),
		)
		process.exit(1)
	}

	// Create output directory if it doesn't exist
	const outDir = dirname(outFile)
	if (!existsSync(outDir)) {
		const { mkdirSync } = await import("node:fs")
		mkdirSync(outDir, { recursive: true })
	}

	// Get URL format of the entry file for dev mode
	const entryFileUrl = pathToFileURL(entryFile).href

	// Resolve bootstrap paths
	const bootstrapPath = resolveBootstrapPath("bootstrap")

	console.log(chalk.blue("🔨 Building MCP server..."))

	// Common build options
	const commonOptions: esbuild.BuildOptions = {
		bundle: true,
		platform: "node",
		target: "node20",
		outfile: outFile,
		sourcemap: "inline",
		format: "cjs",
		external: ["@modelcontextprotocol/sdk", "@smithery/sdk"],
	}

	let buildConfig: esbuild.BuildOptions

	if (options.production) {
		// Production build: compile user entry and bundle with production bootstrap
		const tempOutFile = join(
			process.cwd(),
			dirname(outFile),
			"user-compiled.js",
		)

		// First, compile the user's TypeScript to JavaScript
		await esbuild.build({
			...commonOptions,
			entryPoints: [entryFile],
			outfile: tempOutFile,
			sourcemap: false, // Don't need sourcemap for intermediate file
		})

		// Create an alias plugin to resolve the user module import
		const aliasPlugin: esbuild.Plugin = {
			name: "alias-plugin",
			setup(build) {
				build.onResolve({ filter: /^__SMITHERY_USER_MODULE__$/ }, () => ({
					path: tempOutFile,
					external: false,
				}))
			},
		}

		// Bundle the production bootstrap with the compiled user code
		buildConfig = {
			...commonOptions,
			entryPoints: [bootstrapPath],
			plugins: [aliasPlugin],
			define: {
				__SMITHERY_ENTRY__: "undefined",
			},
		}
	} else {
		// Development build: use dev bootstrap with dynamic imports
		buildConfig = {
			...commonOptions,
			entryPoints: [entryFile],
			inject: [bootstrapPath],
			define: {
				__SMITHERY_ENTRY__: JSON.stringify(entryFileUrl),
				__SMITHERY_USER_MODULE__: "undefined",
			},
		}
	}

	if (options.watch && options.onRebuild) {
		// Set up esbuild with watch mode and rebuild plugin
		const plugins: esbuild.Plugin[] = [
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
