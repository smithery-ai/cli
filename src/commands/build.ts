import { buildMcpServer } from "../lib/build"

interface BuildOptions {
	outFile?: string
}

export async function build(options: BuildOptions = {}): Promise<void> {
	try {
		await buildMcpServer({
			outFile: options.outFile,
			watch: false,
			production: true,
		})
	} catch (error) {
		console.error("❌ Build failed:", error)
		process.exit(1)
	}
}
