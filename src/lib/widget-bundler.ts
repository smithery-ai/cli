import { existsSync, mkdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import chalk from "chalk"
import * as esbuild from "esbuild"
import { formatFileSize } from "../utils/build"
import type { WidgetInfo } from "./widget-discovery"

function generateWidgetEntry(widgetName: string, componentPath: string): string {
	return `
import React, { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import Widget from ${JSON.stringify(componentPath)}

const root = document.getElementById("${widgetName}-root")
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Widget />
    </StrictMode>
  )
}
`.trim()
}

function createWidgetEntryPlugin(widget: WidgetInfo): esbuild.Plugin {
	return {
		name: "widget-entry-plugin",
		setup(build) {
			build.onResolve({ filter: /^virtual:widget-entry$/ }, () => ({
				path: "virtual:widget-entry",
				namespace: "widget-entry",
			}))

			build.onLoad({ filter: /.*/, namespace: "widget-entry" }, () => {
				const componentPath = resolve(process.cwd(), widget.componentFile)
				const entryCode = generateWidgetEntry(widget.name, componentPath)

				return {
					contents: entryCode,
					loader: "tsx",
					resolveDir: process.cwd(),
				}
			})
		},
	}
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

	const buildConfig: esbuild.BuildOptions = {
		entryPoints: ["virtual:widget-entry"],
		bundle: true,
		format: "esm",
		outfile: outFile,
		minify: options.production === true,
		sourcemap: options.production ? false : "inline",
		treeShaking: true,
		jsx: "automatic",
		target: "es2020",
		platform: "browser",
		loader: {
			".css": "css",
		},
		plugins: [createWidgetEntryPlugin(widget)],
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
		console.log(chalk.dim(`    ${bundlePath}  ${chalk.yellow(fileSize)}${buildMode}`))
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

