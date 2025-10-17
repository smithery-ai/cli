import { existsSync } from "node:fs"
import { join } from "node:path"
import chalk from "chalk"
import { readSmitheryConfig } from "../config"
import { discoverWidgets } from "./widget-discovery"

export function validateWidgetProject(cwd: string = process.cwd()): void {
	const config = readSmitheryConfig(cwd)

	if (config.type !== "widget") {
		return
	}

	const webSrcDir = join(cwd, "app/web/src")

	if (!existsSync(webSrcDir)) {
		throw new Error(
			`${chalk.red("✗ Widget project missing app/web/src directory")}\n\n` +
				`Your smithery.yaml specifies type: widget, but app/web/src/ does not exist.\n\n` +
				`Fix this by either:\n` +
				`  1. Creating the directory: mkdir -p app/web/src\n` +
				`  2. Changing type to "server" in smithery.yaml if you don't need widgets`,
		)
	}

	const widgets = discoverWidgets(cwd)

	if (widgets.length === 0) {
		console.warn(
			chalk.yellow(
				`⚠️  Warning: type: widget specified but no .tsx files found in app/web/src/`,
			),
		)
		console.warn(
			chalk.dim(`   Create a widget component like app/web/src/my-widget.tsx`),
		)
	}

	for (const widget of widgets) {
		const componentPath = join(cwd, widget.componentFile)
		if (!existsSync(componentPath)) {
			throw new Error(
				`${chalk.red(`✗ Widget component not found: ${widget.componentFile}`)}\n\n` +
					`Expected file does not exist: ${componentPath}`,
			)
		}
	}

	console.log(chalk.dim("✓ Widget project structure validated"))
}
