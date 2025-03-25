import { config } from "dotenv"
import * as esbuild from "esbuild"

// Load environment variables into a define object
config()
const define = {}

for (const k in process.env) {
	define[`process.env.${k}`] = JSON.stringify(process.env[k])
}

await esbuild.build({
	entryPoints: ["src/index.ts"],
	bundle: true,
	platform: "node",
	target: "node18",
	minify: true,
	treeShaking: true,
	outfile: "dist/index.js",
	define,
})
