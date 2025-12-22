import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse as parseYaml } from "yaml"

export interface SmitheryConfig {
	runtime: string
	type?: "server"
	target?: "local" | "remote"
	build?: Record<string, unknown>
	startCommand?: Record<string, unknown>
}

export function readSmitheryConfig(
	cwd: string = process.cwd(),
): SmitheryConfig {
	const configPath = join(cwd, "smithery.yaml")

	if (!existsSync(configPath)) {
		throw new Error(
			"smithery.yaml not found. Please ensure you're in a Smithery project directory.",
		)
	}

	const yamlContent = readFileSync(configPath, "utf-8")
	const config = parseYaml(yamlContent) as SmitheryConfig

	if (!config.runtime) {
		throw new Error(
			'smithery.yaml must specify a "runtime" field (e.g., runtime: typescript)',
		)
	}

	return {
		runtime: config.runtime,
		type: config.type || "server",
		target: config.target,
		build: config.build,
		startCommand: config.startCommand,
	}
}
