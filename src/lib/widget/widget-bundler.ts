import { existsSync, mkdirSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import chalk from "chalk"
import * as esbuild from "esbuild"
import { formatFileSize } from "../../utils/build"
import type { WidgetInfo } from "./widget-discovery"

function resolveEntryPoint(cwd: string): string {
	// Look for user-provided index file
	const possibleEntries = [
		resolve(cwd, "app/web/src/index.tsx"),
		resolve(cwd, "app/web/src/index.ts"),
		resolve(cwd, "app/web/src/index.jsx"),
		resolve(cwd, "app/web/src/index.js"),
	]

	for (const entry of possibleEntries) {
		if (existsSync(entry)) {
			return entry
		}
	}

	throw new Error("No index file found in app/web/src/. Please create app/web/src/index.tsx")
}

async function buildWidget(
	widget: WidgetInfo,
	options: { production?: boolean; cwd?: string },
): Promise<void> {
	const { name, bundlePath } = widget
	const cwd = options.cwd || process.cwd()

	console.log(chalk.dim(`  Building widget: ${chalk.cyan(name)}`))

	const outFile = resolve(cwd, bundlePath)
	const outDir = dirname(outFile)

	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true })
	}

	// Use user-defined index.tsx entry point
	const entryPoint = resolveEntryPoint(cwd)
	console.log(chalk.dim(`    Using entry: ${entryPoint}`))

	// Simple build config following OpenAI's pattern
	const buildConfig: esbuild.BuildOptions = {
		entryPoints: [entryPoint],
		bundle: true,
		format: "esm",
		outfile: outFile,
		minify: options.production === true,
		sourcemap: options.production ? false : "inline",
		treeShaking: true,
		target: "es2020",
		platform: "browser",
		loader: {
			".css": "text", // Simple CSS loading like manual build
		},
		define: {
			"process.env.NODE_ENV": JSON.stringify(
				options.production ? "production" : "development",
			),
		},
		nodePaths: [
			resolve(cwd, "app/web/node_modules"),
			resolve(cwd, "node_modules"),
		],
	}

	const result = await esbuild.build(buildConfig)

	if (result.errors.length > 0) {
		console.error(chalk.red(`✗ Widget build failed: ${name}`))
		console.error(result.errors)
		throw new Error(`Widget build failed: ${name}`)
	}

	if (existsSync(outFile)) {
		const stats = statSync(outFile)
		const fileSize = formatFileSize(stats.size)
		const buildMode = options.production ? "" : " (dev)"
		console.log(
			chalk.dim(`    ${bundlePath}  ${chalk.yellow(fileSize)}${buildMode}`),
		)
	}
}

export async function buildWidgets(
	widgets: WidgetInfo[],
	options: { production?: boolean; cwd?: string } = {},
): Promise<void> {
	if (widgets.length === 0) {
		return
	}

	console.log(chalk.dim(`\nBuilding ${widgets.length} widget(s)...`))

	await Promise.all(widgets.map((widget) => buildWidget(widget, options)))

	console.log(chalk.green(`✓ Widgets built successfully\n`))
}
