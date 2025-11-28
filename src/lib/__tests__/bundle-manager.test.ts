import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	getBundleCommand,
	resolveEnvTemplates,
	resolveTemplateString,
} from "../bundle-manager.js"

describe("Bundle Manager", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = `/tmp/bundle-manager-test-${Date.now()}`
		await mkdir(tempDir, { recursive: true })
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
	})

	describe("resolveTemplateString", () => {
		it("should resolve __dirname template", () => {
			const result = resolveTemplateString(
				`\${__dirname}/server.js`,
				{},
				"/bundle/path",
			)
			expect(result).toBe("/bundle/path/server.js")
		})

		it("should resolve user_config template", () => {
			const userConfig = { apiKey: "secret123" }
			const result = resolveTemplateString(`\${user_config.apiKey}`, userConfig)
			expect(result).toBe("secret123")
		})

		it("should resolve nested user_config template", () => {
			const userConfig = { database: { host: "localhost", port: 5432 } }
			const result = resolveTemplateString(
				`\${user_config.database.host}`,
				userConfig,
			)
			expect(result).toBe("localhost")
		})

		it("should handle missing user_config values", () => {
			const result = resolveTemplateString(`\${user_config.missingKey}`, {})
			expect(result).toBe(`\${user_config.missingKey}`) // Returns original if not found
		})

		it("should handle non-template strings", () => {
			const result = resolveTemplateString("plain-string", {}, "/bundle/path")
			expect(result).toBe("plain-string")
		})

		it("should handle multiple templates in one string", () => {
			const userConfig = { host: "localhost", port: "8080" }
			const result = resolveTemplateString(
				`\${user_config.host}:\${user_config.port}`,
				userConfig,
			)
			expect(result).toBe("localhost:8080")
		})
	})

	describe("resolveEnvTemplates", () => {
		it("should resolve env vars with user_config templates", () => {
			const env = {
				API_KEY: `\${user_config.apiKey}`,
				DATABASE_URL: `\${user_config.database.host}:\${user_config.database.port}`,
			}
			const userConfig = {
				apiKey: "secret123",
				database: { host: "localhost", port: 5432 },
			}

			const result = resolveEnvTemplates(env, userConfig, "/bundle/path")

			expect(result).toEqual({
				API_KEY: "secret123",
				DATABASE_URL: "localhost:5432",
			})
		})

		it("should handle empty env object", () => {
			const result = resolveEnvTemplates({}, {}, "/bundle/path")
			expect(result).toEqual({})
		})

		it("should handle env vars without templates", () => {
			const env = {
				NODE_ENV: "production",
				PORT: "3000",
			}

			const result = resolveEnvTemplates(env, {}, "/bundle/path")
			expect(result).toEqual(env)
		})
	})

	describe("getBundleCommand", () => {
		it("should parse basic node command manifest", async () => {
			const manifest = {
				server: {
					mcp_config: {
						command: "node",
						args: [`\${__dirname}/server.js`],
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
						args: [`\${__dirname}/main.py`],
						env: {
							API_KEY: `\${user_config.apiKey}`,
							DEBUG: `\${user_config.debugMode}`,
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
				API_KEY: `\${user_config.apiKey}`,
				DEBUG: `\${user_config.debugMode}`,
			})
		})

		it("should handle manifest without env vars", async () => {
			const manifest = {
				server: {
					mcp_config: {
						command: "node",
						args: [`\${__dirname}/server.js`],
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
						args: [`\${__dirname}/server.js`],
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
							`--config=\${__dirname}/config.json`,
							`--data=\${__dirname}/data`,
							`--output=\${__dirname}/output.log`,
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
							`--api-key=\${user_config.apiKey}`,
							`--port=\${user_config.port}`,
							`--host=\${__dirname}/server.js`,
						],
					},
				},
			}

			const manifestPath = join(tempDir, "manifest.json")
			await writeFile(manifestPath, JSON.stringify(manifest))

			const result = getBundleCommand(tempDir)

			// Note: user_config templates in args are not resolved here
			// They would be resolved when calling resolveEnvTemplates separately
			expect(result.args).toEqual([
				`--api-key=\${user_config.apiKey}`,
				`--port=\${user_config.port}`,
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

	describe("Template Resolution Integration", () => {
		it("should handle complete manifest with args and env resolution", async () => {
			const manifest = {
				server: {
					mcp_config: {
						command: "node",
						args: [
							`\${__dirname}/server.js`,
							`--config=\${user_config.configPath}`,
						],
						env: {
							API_KEY: `\${user_config.apiKey}`,
							DATABASE_URL: `\${user_config.database.host}:\${user_config.database.port}`,
							LOG_FILE: `\${__dirname}/logs/app.log`,
						},
					},
				},
			}

			const manifestPath = join(tempDir, "manifest.json")
			await writeFile(manifestPath, JSON.stringify(manifest))

			const { command, args, env } = getBundleCommand(tempDir)
			const userConfig = {
				apiKey: "secret123",
				configPath: "/custom/config.json",
				database: { host: "localhost", port: 5432 },
			}

			const resolvedArgs = args.map((arg) =>
				resolveTemplateString(arg, userConfig, tempDir),
			)
			const resolvedEnv = resolveEnvTemplates(env!, userConfig, tempDir)

			expect(command).toBe("node")
			expect(resolvedArgs).toEqual([
				`${tempDir}/server.js`,
				"--config=/custom/config.json",
			])
			expect(resolvedEnv).toEqual({
				API_KEY: "secret123",
				DATABASE_URL: "localhost:5432",
				LOG_FILE: `${tempDir}/logs/app.log`,
			})
		})
	})
})
