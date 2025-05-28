import { config } from "dotenv"
import * as esbuild from "esbuild"
import { existsSync, mkdirSync } from "node:fs"

// Load environment variables into a define object
config()
const define = {}

for (const k in process.env) {
	/* Skip environment variables that should be evaluated at runtime */
	if (["HOME", "USER", "XDG_CONFIG_HOME"].includes(k)) continue

	define[`process.env.${k}`] = JSON.stringify(process.env[k])
}

// Build main CLI entry point
await esbuild.build({
	entryPoints: ["src/index.ts"],
	bundle: true,
	platform: "node",
	target: "node18",
	minify: true,
	treeShaking: true,
	outfile: "dist/index.js",
	external: ["@ngrok/ngrok", "esbuild"],
	define,
})

// Copy runtime files to dist/runtime/
const runtimeDir = "dist/runtime"
if (!existsSync(runtimeDir)) {
	mkdirSync(runtimeDir, { recursive: true })
}

// Compile bootstrap.ts to JavaScript and copy to dist/runtime/
await esbuild.build({
	entryPoints: ["src/runtime/bootstrap.ts"],
	bundle: false, // Don't bundle, just compile
	platform: "node",
	target: "node18",
	outfile: "dist/runtime/bootstrap.js",
	format: "cjs",
})

console.log("✅ Build complete - runtime files copied")
