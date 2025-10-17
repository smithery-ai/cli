import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import chalk from "chalk"

export interface WidgetInfo {
	name: string
	componentFile: string
	cssFile?: string
	bundlePath: string
}

export function discoverWidgets(cwd: string = process.cwd()): WidgetInfo[] {
	const webSrcDir = join(cwd, "app/web/src")

	if (!existsSync(webSrcDir)) {
		return []
	}

	const files = readdirSync(webSrcDir)
	const widgetFiles = files.filter(
		(f) => f.endsWith(".tsx") && !f.startsWith("types") && f !== "index.tsx",
	)

	if (widgetFiles.length === 0) {
		console.warn(chalk.yellow("⚠️  No .tsx widgets found in app/web/src/"))
		return []
	}

	const widgets = widgetFiles.map((file) => {
		const name = file.replace(".tsx", "")
		const cssFile = `${name}.css`
		const cssPath = join(webSrcDir, cssFile)

		return {
			name,
			componentFile: join("app/web/src", file),
			cssFile: existsSync(cssPath) ? join("app/web/src", cssFile) : undefined,
			bundlePath: join(".smithery", `${name}.js`),
		}
	})

	console.log(
		chalk.dim(
			`Found ${widgets.length} widget(s): ${widgets.map((w) => w.name).join(", ")}`,
		),
	)

	const widgetsWithCss = widgets.filter((w) => w.cssFile)
	if (widgetsWithCss.length > 0) {
		console.log(
			chalk.dim(
				`  ${widgetsWithCss.length} widget(s) with CSS: ${widgetsWithCss.map((w) => w.name).join(", ")}`,
			),
		)
	}

	return widgets
}
