import {
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"

declare global {
	var __SMITHERY_VERSION__: string
}

const tempDirs: string[] = []
let isDirectExecution!: typeof import("../index").isDirectExecution

beforeAll(async () => {
	globalThis.__SMITHERY_VERSION__ = "test"
	;({ isDirectExecution } = await import("../index"))
})

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true })
	}
})

afterAll(() => {
	delete (globalThis as { __SMITHERY_VERSION__?: string }).__SMITHERY_VERSION__
})

describe("isDirectExecution", () => {
	test("matches the module url for direct execution", () => {
		const entry = pathToFileURL(join(process.cwd(), "dist/index.js")).href

		expect(isDirectExecution(join(process.cwd(), "dist/index.js"), entry)).toBe(
			true,
		)
	})

	test("resolves symlinked bin paths before comparing module urls", () => {
		const dir = mkdtempSync(join(tmpdir(), "smithery-entrypoint-"))
		tempDirs.push(dir)

		const target = join(dir, "target.js")
		const link = join(dir, "bin.js")
		writeFileSync(target, "#!/usr/bin/env node\n")
		symlinkSync(target, link)

		expect(
			isDirectExecution(link, pathToFileURL(realpathSync(target)).href),
		).toBe(true)
	})

	test("returns false for unrelated paths", () => {
		const entry = pathToFileURL(join(process.cwd(), "dist/index.js")).href

		expect(isDirectExecution("/tmp/not-smithery.js", entry)).toBe(false)
		expect(isDirectExecution(undefined, entry)).toBe(false)
	})
})
