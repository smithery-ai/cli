import { readFile } from "node:fs/promises"
import { dirname } from "node:path"
import { Log, LogLevel, Miniflare } from "miniflare"

export interface DevServerOptions {
	port: number
	modulePath: string
}

class SmitheryLog extends Log {
	protected log(message: string): void {
		const transformed = message.replace(/^\[.*?:(.*?)\] /, "$1 ")
		console.log(transformed)
	}
}

async function getModuleSourceOptions(modulePath: string) {
	const modulesRoot = dirname(modulePath)
	const entrypointSource = await readFile(modulePath, "utf-8")

	return {
		modulesRoot,
		modules: [
			{
				type: "ESModule" as const,
				path: modulePath,
				contents: entrypointSource,
			},
		],
	}
}

export async function createDevServer(options: DevServerOptions) {
	const sourceOptions = await getModuleSourceOptions(options.modulePath)

	const mf = new Miniflare({
		...sourceOptions,
		compatibilityDate: "2026-01-07",
		compatibilityFlags: ["nodejs_compat"],
		host: "127.0.0.1",
		port: options.port,
		durableObjects: { MCP_SESSION: "McpSession" },
		cache: false,
		log: new SmitheryLog(LogLevel.INFO),
		verbose: false,
	})

	// Wait for server to be listening before returning
	await mf.ready

	console.log(`[Dev] Listening on http://127.0.0.1:${options.port}`)

	return {
		mf,
		reload: async () => {
			const updatedSourceOptions = await getModuleSourceOptions(
				options.modulePath,
			)
			await mf.setOptions(updatedSourceOptions)
		},
		close: async () => {
			await mf.dispose()
		},
	}
}
