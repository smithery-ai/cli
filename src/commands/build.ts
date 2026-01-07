import { buildServer } from "../lib/build"
import { buildDeployBundle } from "../lib/bundle"

interface BuildOptions {
	entryFile?: string
	outFile?: string
	transport?: "shttp" | "stdio"
}

export async function build(options: BuildOptions = {}): Promise<void> {
	try {
		const transport = options.transport || "shttp"

		if (transport === "shttp") {
			// For shttp, create the deploy bundle (manifest + user module)
			await buildDeployBundle({
				entryFile: options.entryFile,
				outDir: options.outFile ? undefined : ".smithery/bundle",
				production: true,
			})
		} else {
			// For stdio, just build the Node.js bundle
			await buildServer({
				entryFile: options.entryFile,
				outFile: options.outFile,
				transport: "stdio",
				watch: false,
				production: true,
			})
		}
	} catch (error) {
		console.error("✗ Build failed:", error)
		process.exit(1)
	}
}
