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
	// Keep these dynamic so code isn't tree-shaken based on CI build env
	if (
		[
			"HOME",
			"USER",
			"XDG_CONFIG_HOME",
			"SMITHERY_BEARER_AUTH",
			"ANALYTICS_ENDPOINT",
		].includes(k)
	)
		continue

	// Skip variables whose names are not dot-safe identifiers (e.g., those containing hyphens, parentheses, etc.)
	if (!isDotSafeIdentifier(k)) continue

	define[`process.env.${k}`] = JSON.stringify(process.env[k])
}

// 1. Bundle bootstraps into string constants
console.log("Compiling bootstraps...")

const shttp = await esbuild.build({
	entryPoints: ["src/runtime/shttp-bootstrap.ts"],
	bundle: true,
	format: "esm",
	platform: "browser",
	target: "es2022",
	write: false,
	minify: true,
	external: ["virtual:user-module"],
})

const stdio = await esbuild.build({
	entryPoints: ["src/runtime/stdio-bootstrap.ts"],
	bundle: true,
	format: "esm",
	platform: "node",
	target: "node20",
	write: false,
	minify: true,
	external: ["virtual:user-module"],
})

define.__SHTTP_BOOTSTRAP__ = JSON.stringify(shttp.outputFiles[0].text)
define.__STDIO_BOOTSTRAP__ = JSON.stringify(stdio.outputFiles[0].text)

// Get package version
const packageJson = JSON.parse(readFileSync("package.json", "utf-8"))

// Inject version as global constant
define.__SMITHERY_VERSION__ = JSON.stringify(packageJson.version)

console.log("✓ Compiled bootstrap files")

// Packages with native binaries that cannot be bundled - they must be required at runtime.
// Only include packages that are DIRECTLY imported by CLI code and have native binaries.
// Transitive native deps (like workerd via miniflare) are handled by their parent package.
// - keytar: .node native addon for OS keychain
// - esbuild: platform-specific binaries for bundling
// - @ngrok/ngrok: native binary for tunneling
// - miniflare: has complex native deps (workerd) that must resolve at runtime
// - cross-spawn: has pnpm symlink resolution issues with path-key
// - jsonc-parser: uses AMD-style dynamic requires that can't be bundled
const nativePackages = [
	"@ngrok/ngrok",
	"cross-spawn",
	"esbuild",
	"jsonc-parser",
	"keytar",
	"miniflare",
]

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
	external: nativePackages,
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

console.log("✓ Build complete")
