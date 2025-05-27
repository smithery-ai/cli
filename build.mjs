import { config } from "dotenv"
import * as esbuild from "esbuild"

// Load environment variables into a define object
config()
const define = {}

for (const k in process.env) {
	/* Skip environment variables that should be evaluated at runtime */
	if (["HOME", "USER", "XDG_CONFIG_HOME"].includes(k)) continue

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
	external: ["@ngrok/ngrok"],
	define,
})
