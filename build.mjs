import * as esbuild from "esbuild"
import { config } from "dotenv"

// Load environment variables
config()

await esbuild.build({
	entryPoints: ["src/index.ts"],
	bundle: true,
	platform: "node",
	target: "node18",
	minify: true,
	treeShaking: true,
	outfile: "dist/index.js",
})
