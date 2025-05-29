import { buildMcpServer } from "../lib/build"

interface BuildOptions {
	entryFile?: string
	outFile?: string
	transport?: "shttp" | "stdio"
}

export async function build(options: BuildOptions = {}): Promise<void> {
	try {
		await buildMcpServer({
			entryFile: options.entryFile,
			outFile: options.outFile,
			transport: options.transport,
			watch: false,
			production: true,
		})
	} catch (error) {
		console.error("❌ Build failed:", error)
		process.exit(1)
	}
}
