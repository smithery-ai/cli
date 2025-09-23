import { buildServer } from "../lib/build"

interface BuildOptions {
	entryFile?: string
	outFile?: string
	transport?: "shttp" | "stdio"
	configFile?: string
	buildTool?: "esbuild" | "bun"
}

export async function build(options: BuildOptions = {}): Promise<void> {
	try {
		await buildServer({
			entryFile: options.entryFile,
			outFile: options.outFile,
			transport: options.transport,
			watch: false,
			production: true,
			configFile: options.configFile,
			buildTool: options.buildTool,
		})
	} catch (error) {
		console.error("✗ Build failed:", error)
		process.exit(1)
	}
}
