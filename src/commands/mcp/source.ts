import { readFile, realpath, stat } from "node:fs/promises"
import path from "node:path"
import type { ConnectionCreateParams } from "@smithery/api/resources/connections.js"

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"])
const MAX_SOURCE_FILE_BYTES = 128 * 1024
const STDIN_SOURCE_PATH = "stdin.ts"
const RELATIVE_IMPORT_PATTERN =
	/\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']|\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g

export type DynamicMcpModuleSource = NonNullable<
	ConnectionCreateParams["source"]
>

export async function loadDynamicMcpModuleSource(
	sourcePath: string,
	cwd = process.cwd(),
	readStdin = readStdinSource,
): Promise<DynamicMcpModuleSource> {
	if (sourcePath === "-") {
		if (readStdin === readStdinSource && process.stdin.isTTY) {
			throw new Error("--source - requires TypeScript source on stdin.")
		}
		const contents = await readStdin()
		return buildModuleSource(STDIN_SOURCE_PATH, contents)
	}

	const absolutePath = path.resolve(cwd, sourcePath)
	const [realCwd, realSourcePath] = await Promise.all([
		realpath(cwd),
		realpath(absolutePath).catch((error: unknown) => {
			throw new Error(`Source file not found: ${sourcePath}`, { cause: error })
		}),
	])

	if (!isPathInside(realSourcePath, realCwd)) {
		throw new Error("Source file must be inside the current working directory.")
	}

	const sourceStat = await stat(realSourcePath)
	if (!sourceStat.isFile()) {
		throw new Error(`Source path must be a file: ${sourcePath}`)
	}
	if (sourceStat.size > MAX_SOURCE_FILE_BYTES) {
		throw new Error("Source file must be 128KB or smaller.")
	}

	if (!SOURCE_EXTENSIONS.has(path.extname(realSourcePath))) {
		throw new Error("Source file must end in .ts, .tsx, .mts, or .cts.")
	}

	const relativePath = toPosixPath(path.relative(realCwd, realSourcePath))
	const contents = await readFile(realSourcePath, "utf8")
	return buildModuleSource(relativePath, contents)
}

function buildModuleSource(
	entrypoint: string,
	contents: string,
): DynamicMcpModuleSource {
	if (Buffer.byteLength(contents, "utf8") > MAX_SOURCE_FILE_BYTES) {
		throw new Error("Source file must be 128KB or smaller.")
	}

	const relativeImport = findRelativeImport(contents)
	if (relativeImport) {
		throw new Error(
			`Source file imports ${relativeImport}; --source currently supports a single entrypoint file only.`,
		)
	}

	return {
		kind: "module",
		entrypoint,
		sourceFiles: [
			{
				path: entrypoint,
				contents,
			},
		],
	}
}

async function readStdinSource(): Promise<string> {
	const chunks: Buffer[] = []
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
	}
	return Buffer.concat(chunks).toString("utf8")
}

function isPathInside(filePath: string, rootPath: string): boolean {
	const relative = path.relative(rootPath, filePath)
	return (
		relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
	)
}

function toPosixPath(value: string): string {
	return value.split(path.sep).join(path.posix.sep)
}

function findRelativeImport(contents: string): string | undefined {
	for (const match of contents.matchAll(RELATIVE_IMPORT_PATTERN)) {
		return match[1] ?? match[2]
	}
	return undefined
}
