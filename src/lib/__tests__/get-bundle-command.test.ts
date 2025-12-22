import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getBundleCommand } from "../mcpb.js"

describe("getBundleCommand", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = `/tmp/bundle-manager-test-${Date.now()}`
		await mkdir(tempDir, { recursive: true })
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
	})

	it("should parse basic node command manifest", async () => {
		const manifest = {
			server: {
				mcp_config: {
					command: "node",
					args: ["${__dirname}/server.js"],
				},
			},
		}

		const manifestPath = join(tempDir, "manifest.json")
		await writeFile(manifestPath, JSON.stringify(manifest))

		const result = getBundleCommand(tempDir)

		expect(result).toEqual({
			command: "node",
			args: [`${tempDir}/server.js`],
			env: undefined,
		})
	})

	it("should parse manifest with env vars", async () => {
		const manifest = {
			server: {
				mcp_config: {
					command: "python",
					args: ["${__dirname}/main.py"],
					env: {
						API_KEY: "${user_config.apiKey}",
						DEBUG: "${user_config.debugMode}",
					},
				},
			},
		}

		const manifestPath = join(tempDir, "manifest.json")
		await writeFile(manifestPath, JSON.stringify(manifest))

		const result = getBundleCommand(tempDir)

		expect(result.command).toBe("python")
		expect(result.args).toEqual([`${tempDir}/main.py`])
		expect(result.env).toEqual({
			API_KEY: "${user_config.apiKey}",
			DEBUG: "${user_config.debugMode}",
		})
	})

	it("should handle manifest without env vars", async () => {
		const manifest = {
			server: {
				mcp_config: {
					command: "node",
					args: ["${__dirname}/server.js"],
				},
			},
		}

		const manifestPath = join(tempDir, "manifest.json")
		await writeFile(manifestPath, JSON.stringify(manifest))

		const result = getBundleCommand(tempDir)

		expect(result.env).toBeUndefined()
	})

	it("should throw error for missing manifest", () => {
		expect(() => getBundleCommand(tempDir)).toThrow(
			"Bundle manifest not found",
		)
	})

	it("should throw error for missing command", async () => {
		const manifest = {
			server: {
				mcp_config: {
					args: ["${__dirname}/server.js"],
				},
			},
		}

		const manifestPath = join(tempDir, "manifest.json")
		await writeFile(manifestPath, JSON.stringify(manifest))

		expect(() => getBundleCommand(tempDir)).toThrow(
			"Bundle manifest missing server.mcp_config.command",
		)
	})

	it("should handle complex args with multiple __dirname references", async () => {
		const manifest = {
			server: {
				mcp_config: {
					command: "node",
					args: [
						"--config=${__dirname}/config.json",
						"--data=${__dirname}/data",
						"--output=${__dirname}/output.log",
					],
				},
			},
		}

		const manifestPath = join(tempDir, "manifest.json")
		await writeFile(manifestPath, JSON.stringify(manifest))

		const result = getBundleCommand(tempDir)

		expect(result.args).toEqual([
			`--config=${tempDir}/config.json`,
			`--data=${tempDir}/data`,
			`--output=${tempDir}/output.log`,
		])
	})

	it("should handle args with user_config templates", async () => {
		const manifest = {
			server: {
				mcp_config: {
					command: "node",
					args: [
						"--api-key=${user_config.apiKey}",
						"--port=${user_config.port}",
						"--host=${__dirname}/server.js",
					],
				},
			},
		}

		const manifestPath = join(tempDir, "manifest.json")
		await writeFile(manifestPath, JSON.stringify(manifest))

		const result = getBundleCommand(tempDir)

		// Note: user_config templates in args are not resolved here
		// They would be resolved when calling hydrateBundleCommand
		expect(result.args).toEqual([
			"--api-key=${user_config.apiKey}",
			"--port=${user_config.port}",
			`--host=${tempDir}/server.js`,
		])
	})

	it("should handle empty args array", async () => {
		const manifest = {
			server: {
				mcp_config: {
					command: "node",
					args: [],
				},
			},
		}

		const manifestPath = join(tempDir, "manifest.json")
		await writeFile(manifestPath, JSON.stringify(manifest))

		const result = getBundleCommand(tempDir)

		expect(result.args).toEqual([])
	})
})

