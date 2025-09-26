import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { config } from "dotenv"
import * as esbuild from "esbuild"

// Load environment variables into a define object
config({ quiet: true })
const define = {}

const isDotSafeIdentifier = (str) => {
	return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str)
}

for (const k in process.env) {
	/* Skip environment variables that should be evaluated at runtime */
	if (["HOME", "USER", "XDG_CONFIG_HOME"].includes(k)) continue

	// Skip variables whose names are not dot-safe identifiers (e.g., those containing hyphens, parentheses, etc.)
	if (!isDotSafeIdentifier(k)) continue

	define[`process.env.${k}`] = JSON.stringify(process.env[k])
}

// Compile bootstrap TypeScript files to JavaScript
console.log("Compiling bootstrap files...")
const shttpResult = await esbuild.build({
	entryPoints: ["src/runtime/shttp-bootstrap.ts"],
	bundle: true,
	platform: "node",
	target: "node20",
	format: "esm",
	write: false,
	external: [
		"virtual:user-module",
		"@smithery/sdk",
		"@smithery/sdk/*",
		"@modelcontextprotocol/sdk",
		"@modelcontextprotocol/sdk/*",
	],
})

const stdioResult = await esbuild.build({
	entryPoints: ["src/runtime/stdio-bootstrap.ts"],
	bundle: true,
	platform: "node",
	target: "node20",
	format: "esm",
	write: false,
	external: [
		"virtual:user-module",
		"@smithery/sdk",
		"@smithery/sdk/*",
		"@modelcontextprotocol/sdk",
		"@modelcontextprotocol/sdk/*",
	],
})

// Get the compiled code as strings and inject via define
const shttpBootstrapJs = shttpResult.outputFiles[0].text
const stdioBootstrapJs = stdioResult.outputFiles[0].text

// Get package version
const packageJson = JSON.parse(readFileSync("package.json", "utf-8"))

// Inject bootstrap content and version as global constants
define.__SMITHERY_SHTTP_BOOTSTRAP__ = JSON.stringify(shttpBootstrapJs)
define.__SMITHERY_STDIO_BOOTSTRAP__ = JSON.stringify(stdioBootstrapJs)
define.__SMITHERY_VERSION__ = JSON.stringify(packageJson.version)

console.log("✓ Compiled bootstrap files")

// Build main CLI entry point
await esbuild.build({
	entryPoints: ["src/index.ts"],
	bundle: true,
	platform: "node",
	target: "node20",
	format: "esm",
	minify: true,
	treeShaking: true,
	outfile: "dist/index.js",
	external: ["@ngrok/ngrok", "esbuild"],
	banner: {
		js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
	},
	define,
})

// Copy runtime files to dist/runtime/
const runtimeDir = "dist/runtime"
if (!existsSync(runtimeDir)) {
	mkdirSync(runtimeDir, { recursive: true })
}

console.log("✓ Build complete - runtime files copied")
