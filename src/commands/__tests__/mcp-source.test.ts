import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { loadDynamicMcpModuleSource } from "../mcp/source"

describe("loadDynamicMcpModuleSource", () => {
	let cwd: string
	let cleanupPaths: string[]

	beforeEach(async () => {
		const parent = path.join(process.cwd(), ".context")
		await mkdir(parent, { recursive: true })
		cwd = await mkdtemp(path.join(parent, "dynamic-source-"))
		cleanupPaths = [cwd]
	})

	afterEach(async () => {
		await Promise.all(
			cleanupPaths.map((cleanupPath) =>
				rm(cleanupPath, { recursive: true, force: true }),
			),
		)
	})

	test("loads a TypeScript entrypoint as a module source body", async () => {
		await mkdir(path.join(cwd, "src"))
		await writeFile(
			path.join(cwd, "src", "support.ts"),
			"export function normalize(input: { text: string }): { text: string } { return input }\n",
		)

		const source = await loadDynamicMcpModuleSource("src/support.ts", cwd)

		expect(source).toEqual({
			kind: "module",
			entrypoint: "src/support.ts",
			sourceFiles: [
				{
					path: "src/support.ts",
					contents:
						"export function normalize(input: { text: string }): { text: string } { return input }\n",
				},
			],
		})
	})

	test("loads piped TypeScript source from stdin", async () => {
		const source = await loadDynamicMcpModuleSource(
			"-",
			cwd,
			async () =>
				"export function normalize(input: { text: string }): { text: string } { return input }\n",
		)

		expect(source).toEqual({
			kind: "module",
			entrypoint: "stdin.ts",
			sourceFiles: [
				{
					path: "stdin.ts",
					contents:
						"export function normalize(input: { text: string }): { text: string } { return input }\n",
				},
			],
		})
	})

	test("rejects unsupported extensions", async () => {
		await writeFile(path.join(cwd, "support.js"), "export {}\n")

		await expect(loadDynamicMcpModuleSource("support.js", cwd)).rejects.toThrow(
			"Source file must end in .ts, .tsx, .mts, or .cts.",
		)
	})

	test("rejects missing files", async () => {
		await expect(loadDynamicMcpModuleSource("missing.ts", cwd)).rejects.toThrow(
			"Source file not found: missing.ts",
		)
	})

	test("rejects directories", async () => {
		await mkdir(path.join(cwd, "src"))

		await expect(loadDynamicMcpModuleSource("src", cwd)).rejects.toThrow(
			"Source path must be a file: src",
		)
	})

	test("rejects relative imports because source submission is entrypoint-only", async () => {
		await writeFile(
			path.join(cwd, "support.ts"),
			'import { normalize } from "./normalize"\nexport { normalize }\n',
		)

		await expect(loadDynamicMcpModuleSource("support.ts", cwd)).rejects.toThrow(
			"Source file imports ./normalize; --source currently supports a single entrypoint file only.",
		)
	})

	test("rejects relative imports from stdin", async () => {
		await expect(
			loadDynamicMcpModuleSource(
				"-",
				cwd,
				async () => 'import { normalize } from "./normalize"\n',
			),
		).rejects.toThrow(
			"Source file imports ./normalize; --source currently supports a single entrypoint file only.",
		)
	})

	test("rejects files over the server source file size limit", async () => {
		await writeFile(path.join(cwd, "large.ts"), "a".repeat(128 * 1024 + 1))

		await expect(loadDynamicMcpModuleSource("large.ts", cwd)).rejects.toThrow(
			"Source file must be 128KB or smaller.",
		)
	})

	test("rejects piped source over the server source file size limit", async () => {
		await expect(
			loadDynamicMcpModuleSource("-", cwd, async () =>
				"a".repeat(128 * 1024 + 1),
			),
		).rejects.toThrow("Source file must be 128KB or smaller.")
	})

	test("rejects files outside the current working directory", async () => {
		const outsideDir = await mkdtemp(path.join(tmpdir(), "dynamic-source-"))
		cleanupPaths.push(outsideDir)
		const outsideFile = path.join(outsideDir, "outside.ts")
		await writeFile(outsideFile, "export {}\n")

		await expect(loadDynamicMcpModuleSource(outsideFile, cwd)).rejects.toThrow(
			"Source file must be inside the current working directory.",
		)
	})
})
