import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { copyBundleAssets } from "../../bundle/copy-assets"

describe("copyBundleAssets", () => {
	const testDir = join(process.cwd(), ".test-copy-assets")
	const baseDir = join(testDir, "project")
	const outDir = join(testDir, "output")

	beforeEach(() => {
		// Clean up and create fresh test directories
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true })
		}
		mkdirSync(baseDir, { recursive: true })
		mkdirSync(outDir, { recursive: true })
	})

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true })
		}
	})

	test("copies single file", async () => {
		writeFileSync(join(baseDir, "config.json"), '{"key": "value"}')

		const result = await copyBundleAssets({
			patterns: ["config.json"],
			baseDir,
			outDir,
		})

		expect(result.copiedFiles).toEqual(["config.json"])
		expect(result.warnings).toEqual([])
		expect(existsSync(join(outDir, "config.json"))).toBe(true)
		expect(readFileSync(join(outDir, "config.json"), "utf-8")).toBe(
			'{"key": "value"}',
		)
	})

	test("copies files with glob pattern", async () => {
		mkdirSync(join(baseDir, "data"), { recursive: true })
		writeFileSync(join(baseDir, "data", "file1.json"), "1")
		writeFileSync(join(baseDir, "data", "file2.json"), "2")

		const result = await copyBundleAssets({
			patterns: ["data/**/*.json"],
			baseDir,
			outDir,
		})

		expect(result.copiedFiles.sort()).toEqual([
			"data/file1.json",
			"data/file2.json",
		])
		expect(result.warnings).toEqual([])
		expect(existsSync(join(outDir, "data", "file1.json"))).toBe(true)
		expect(existsSync(join(outDir, "data", "file2.json"))).toBe(true)
	})

	test("preserves directory structure", async () => {
		mkdirSync(join(baseDir, "templates", "nested"), { recursive: true })
		writeFileSync(
			join(baseDir, "templates", "nested", "template.html"),
			"<html>",
		)

		const result = await copyBundleAssets({
			patterns: ["templates/**"],
			baseDir,
			outDir,
		})

		expect(result.copiedFiles).toEqual(["templates/nested/template.html"])
		expect(
			existsSync(join(outDir, "templates", "nested", "template.html")),
		).toBe(true)
	})

	test("warns when pattern matches no files", async () => {
		const result = await copyBundleAssets({
			patterns: ["nonexistent/**"],
			baseDir,
			outDir,
		})

		expect(result.copiedFiles).toEqual([])
		expect(result.warnings).toEqual([
			'Pattern "nonexistent/**" matched no files',
		])
	})

	test("handles multiple patterns", async () => {
		writeFileSync(join(baseDir, "config.json"), "{}")
		mkdirSync(join(baseDir, "data"), { recursive: true })
		writeFileSync(join(baseDir, "data", "test.txt"), "test")

		const result = await copyBundleAssets({
			patterns: ["config.json", "data/**"],
			baseDir,
			outDir,
		})

		expect(result.copiedFiles.sort()).toEqual(["config.json", "data/test.txt"])
		expect(result.warnings).toEqual([])
	})

	test("excludes node_modules by default", async () => {
		mkdirSync(join(baseDir, "node_modules", "pkg"), { recursive: true })
		writeFileSync(
			join(baseDir, "node_modules", "pkg", "index.js"),
			"module.exports = {}",
		)
		writeFileSync(join(baseDir, "src.js"), "export default {}")

		const result = await copyBundleAssets({
			patterns: ["**/*.js"],
			baseDir,
			outDir,
		})

		expect(result.copiedFiles).toEqual(["src.js"])
		expect(existsSync(join(outDir, "node_modules"))).toBe(false)
	})

	test("excludes .git by default", async () => {
		mkdirSync(join(baseDir, ".git", "objects"), { recursive: true })
		writeFileSync(join(baseDir, ".git", "config"), "[core]")
		writeFileSync(join(baseDir, "src.js"), "export default {}")

		const result = await copyBundleAssets({
			patterns: ["**/*"],
			baseDir,
			outDir,
		})

		expect(result.copiedFiles).toEqual(["src.js"])
		expect(existsSync(join(outDir, ".git"))).toBe(false)
	})

	test("includes dotfiles when pattern specifies", async () => {
		writeFileSync(join(baseDir, ".env.example"), "KEY=value")

		const result = await copyBundleAssets({
			patterns: [".env.example"],
			baseDir,
			outDir,
		})

		expect(result.copiedFiles).toEqual([".env.example"])
		expect(existsSync(join(outDir, ".env.example"))).toBe(true)
	})

	test("handles patterns with no matches gracefully", async () => {
		// fast-glob handles malformed patterns gracefully, returning no matches
		const result = await copyBundleAssets({
			patterns: ["[invalid"],
			baseDir,
			outDir,
		})

		expect(result.copiedFiles).toEqual([])
		expect(result.warnings).toEqual(['Pattern "[invalid" matched no files'])
	})

	test("throws when asset would overwrite reserved bundle file", async () => {
		// index.cjs is the MCPB entry point - must not be overwritten
		writeFileSync(join(baseDir, "index.cjs"), "malicious content")

		await expect(
			copyBundleAssets({
				patterns: ["index.cjs"],
				baseDir,
				outDir,
			}),
		).rejects.toThrow(/would overwrite a reserved bundle file/)
	})

	test("throws for any reserved file", async () => {
		const reservedFiles = [
			"index.cjs",
			"mcpb-manifest.json",
			"manifest.json",
			"server.mcpb",
		]

		for (const file of reservedFiles) {
			writeFileSync(join(baseDir, file), "content")

			await expect(
				copyBundleAssets({
					patterns: [file],
					baseDir,
					outDir,
				}),
			).rejects.toThrow(/would overwrite a reserved bundle file/)
		}
	})

	test("allows reserved filenames in subdirectories", async () => {
		// index.cjs in a subdirectory is fine - only root-level is reserved
		mkdirSync(join(baseDir, "lib"), { recursive: true })
		writeFileSync(join(baseDir, "lib", "index.cjs"), "module content")

		const result = await copyBundleAssets({
			patterns: ["lib/**"],
			baseDir,
			outDir,
		})

		expect(result.copiedFiles).toEqual(["lib/index.cjs"])
		expect(existsSync(join(outDir, "lib", "index.cjs"))).toBe(true)
	})
})
