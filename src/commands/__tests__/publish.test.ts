import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { strFromU8, unzipSync } from "fflate"
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import {
	collectFiles,
	createArchiveFromDirectory,
	parseSkillName,
} from "../skill/publish-utils"

describe("parseSkillName", () => {
	test("extracts name from valid frontmatter", () => {
		const content = `---\nname: my-skill\ndescription: A test\n---\n\nHello`
		expect(parseSkillName(content)).toBe("my-skill")
	})

	test("returns null when no frontmatter", () => {
		expect(parseSkillName("Just some markdown")).toBe(null)
	})

	test("returns null when frontmatter has no name field", () => {
		const content = `---\ndescription: A test\n---\n\nHello`
		expect(parseSkillName(content)).toBe(null)
	})

	test("trims whitespace from name", () => {
		const content = `---\nname:   spaced-name  \n---\n`
		expect(parseSkillName(content)).toBe("spaced-name")
	})

	test("handles CRLF line endings", () => {
		const content = `---\r\nname: crlf-skill\r\ndescription: test\r\n---\r\n\r\nContent`
		expect(parseSkillName(content)).toBe("crlf-skill")
	})
})

describe("collectFiles", () => {
	let tempDir: string

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "skill-test-"))
	})

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true })
	})

	test("collects files from a flat directory", () => {
		writeFileSync(join(tempDir, "SKILL.md"), "# Hello")
		writeFileSync(join(tempDir, "helper.txt"), "data")

		const files = collectFiles(tempDir)
		expect(files.size).toBe(2)
		expect(files.has("SKILL.md")).toBe(true)
		expect(files.has("helper.txt")).toBe(true)
	})

	test("collects files from nested directories", () => {
		writeFileSync(join(tempDir, "SKILL.md"), "# Hello")
		mkdirSync(join(tempDir, "scripts"))
		writeFileSync(join(tempDir, "scripts", "run.sh"), "#!/bin/bash")

		const files = collectFiles(tempDir)
		expect(files.size).toBe(2)
		expect(files.has("scripts/run.sh")).toBe(true)
	})

	test("skips hidden directories", () => {
		writeFileSync(join(tempDir, "SKILL.md"), "# Hello")
		mkdirSync(join(tempDir, ".git"))
		writeFileSync(join(tempDir, ".git", "config"), "secret")

		const files = collectFiles(tempDir)
		expect(files.size).toBe(1)
		expect(files.has(".git/config")).toBe(false)
	})

	test("skips node_modules", () => {
		writeFileSync(join(tempDir, "SKILL.md"), "# Hello")
		mkdirSync(join(tempDir, "node_modules"))
		writeFileSync(join(tempDir, "node_modules", "pkg.json"), "{}")

		const files = collectFiles(tempDir)
		expect(files.size).toBe(1)
		expect(files.has("node_modules/pkg.json")).toBe(false)
	})

	test("returns empty map for empty directory", () => {
		const files = collectFiles(tempDir)
		expect(files.size).toBe(0)
	})
})

describe("createArchiveFromDirectory", () => {
	let tempDir: string

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "skill-zip-"))
	})

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true })
	})

	test("creates a valid ZIP containing directory files", () => {
		const skillContent = "---\nname: test\ndescription: test\n---\n\nHello"
		writeFileSync(join(tempDir, "SKILL.md"), skillContent)
		writeFileSync(join(tempDir, "data.txt"), "some data")

		const zipData = createArchiveFromDirectory(tempDir)
		expect(zipData).toBeInstanceOf(Uint8Array)
		expect(zipData.length).toBeGreaterThan(0)

		// Verify ZIP contents
		const entries = unzipSync(zipData)
		const paths = Object.keys(entries)
		expect(paths).toContain("SKILL.md")
		expect(paths).toContain("data.txt")
		expect(strFromU8(entries["SKILL.md"])).toBe(skillContent)
	})

	test("preserves nested directory structure in ZIP", () => {
		writeFileSync(join(tempDir, "SKILL.md"), "# Skill")
		mkdirSync(join(tempDir, "lib"))
		writeFileSync(join(tempDir, "lib", "util.ts"), "export const x = 1")

		const zipData = createArchiveFromDirectory(tempDir)
		const entries = unzipSync(zipData)
		expect(Object.keys(entries)).toContain("lib/util.ts")
	})

	test("excludes hidden dirs and node_modules from ZIP", () => {
		writeFileSync(join(tempDir, "SKILL.md"), "# Skill")
		mkdirSync(join(tempDir, ".hidden"))
		writeFileSync(join(tempDir, ".hidden", "secret"), "x")
		mkdirSync(join(tempDir, "node_modules"))
		writeFileSync(join(tempDir, "node_modules", "pkg"), "y")

		const zipData = createArchiveFromDirectory(tempDir)
		const entries = unzipSync(zipData)
		const paths = Object.keys(entries)
		expect(paths).toEqual(["SKILL.md"])
	})
})
