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

export async function createDevServer(options: DevServerOptions) {
	const mf = new Miniflare({
		modules: true,
		scriptPath: options.modulePath,
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
			await mf.setOptions({
				scriptPath: options.modulePath,
			})
		},
		close: async () => {
			await mf.dispose()
		},
	}
}
