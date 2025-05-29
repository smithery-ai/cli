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

// Compile bootstrap TypeScript files to JavaScript
console.log("Compiling bootstrap files...")
const shttpResult = await esbuild.build({
	entryPoints: ["src/runtime/shttp-bootstrap.ts"],
	bundle: true,
	platform: "node",
	target: "node18",
	format: "cjs",
	write: false,
	external: ["virtual:user-module"],
})

const stdioResult = await esbuild.build({
	entryPoints: ["src/runtime/stdio-bootstrap.ts"],
	bundle: true,
	platform: "node",
	target: "node18",
	format: "cjs",
	write: false,
	external: ["virtual:user-module"],
})

// Get the compiled code as strings and inject via define
const shttpBootstrapJs = shttpResult.outputFiles[0].text
const stdioBootstrapJs = stdioResult.outputFiles[0].text

// Inject bootstrap content as global constants
define.__SMITHERY_SHTTP_BOOTSTRAP__ = JSON.stringify(shttpBootstrapJs)
define.__SMITHERY_STDIO_BOOTSTRAP__ = JSON.stringify(stdioBootstrapJs)

console.log("✅ Compiled bootstrap files")

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

console.log("✅ Build complete - runtime files copied")
