import { existsSync, readFileSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { buildServer } from "../build"

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_ROOT = resolve(__dirname, "../../../")
const FIXTURES = resolve(CLI_ROOT, "test/fixtures")

// Mock the injected constants that normally come from esbuild define
// @ts-expect-error
globalThis.__SHTTP_BOOTSTRAP__ = `
import createServer from "virtual:user-module";
export default {
  async fetch(request) {
    return new Response("shttp-bootstrap");
  }
};
`
// @ts-expect-error
globalThis.__STDIO_BOOTSTRAP__ =
	"console.log('stdio-bootstrap'); import createServer from 'virtual:user-module';"
// @ts-expect-error
globalThis.__SMITHERY_VERSION__ = "1.0.0"

describe("buildServer integration", () => {
	const outDir = join(CLI_ROOT, ".smithery-test")

	beforeEach(() => {
		if (existsSync(outDir)) {
			rmSync(outDir, { recursive: true, force: true })
		}
	})

	afterEach(() => {
		if (existsSync(outDir)) {
			rmSync(outDir, { recursive: true, force: true })
		}
	})

	test("builds stateless shttp server", async () => {
		const entryFile = join(FIXTURES, "stateless-server/src/index.ts")
		const outFile = join(outDir, "stateless.js")

		await buildServer({
			entryFile,
			outFile,
			transport: "shttp",
			minify: false,
		})

		expect(existsSync(outFile)).toBe(true)
		const content = readFileSync(outFile, "utf-8")
		expect(content).toContain("shttp-bootstrap")
		// Verify it's ESM
		expect(content).toContain("export")
	})

	test("builds stateful shttp server", async () => {
		const entryFile = join(FIXTURES, "stateful-server/src/index.ts")
		const outFile = join(outDir, "stateful.js")

		await buildServer({
			entryFile,
			outFile,
			transport: "shttp",
			minify: false,
		})

		expect(existsSync(outFile)).toBe(true)
		const content = readFileSync(outFile, "utf-8")
		expect(content).toContain("shttp-bootstrap")
		expect(content).toContain("export")
	})

	test("builds stdio server", async () => {
		const entryFile = join(FIXTURES, "stateless-server/src/index.ts")
		const outFile = join(outDir, "stdio.cjs")

		await buildServer({
			entryFile,
			outFile,
			transport: "stdio",
			minify: false,
		})

		expect(existsSync(outFile)).toBe(true)
		const content = readFileSync(outFile, "utf-8")
		expect(content).toContain("stdio-bootstrap")
		// In CJS mode, there should be no top-level export keyword
		expect(content).not.toMatch(/^export\s/m)
	})
})
