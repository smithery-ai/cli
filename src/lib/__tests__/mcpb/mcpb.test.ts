import { mkdtempSync } from "node:fs"
import { rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	getBundleCommand,
	getHydratedBundleCommand,
	hydrateBundleCommand,
} from "../../mcpb.js"

describe("Bundle Manager End-to-End", () => {
	let tempDir: string

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "bundle-manager-test-"))
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
	})

	it("should handle complete manifest with args and env resolution", async () => {
		const manifest = {
			server: {
				mcp_config: {
					command: "node",
					args: [
						// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template strings for testing
						"${__dirname}/server.js",
						// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
						"--config=${user_config.configPath}",
					],
					env: {
						// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template strings for testing
						API_KEY: "${user_config.apiKey}",
						DATABASE_URL:
							// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
							"${user_config.database.host}:${user_config.database.port}",
						// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
						LOG_FILE: "${__dirname}/logs/app.log",
					},
				},
			},
		}

		const manifestPath = join(tempDir, "manifest.json")
		await writeFile(manifestPath, JSON.stringify(manifest))

		const bundleCommand = getBundleCommand(tempDir)
		const userConfig = {
			apiKey: "secret123",
			configPath: "/custom/config.json",
			database: { host: "localhost", port: 5432 },
		}

		const hydrated = hydrateBundleCommand(bundleCommand, userConfig, tempDir)

		expect(hydrated.command).toBe("node")
		expect(hydrated.args).toEqual([
			`${tempDir}/server.js`,
			"--config=/custom/config.json",
		])
		expect(hydrated.env).toEqual({
			API_KEY: "secret123",
			DATABASE_URL: "localhost:5432",
			LOG_FILE: `${tempDir}/logs/app.log`,
		})
	})

	it("should handle complete bundle hydration flow end-to-end", async () => {
		const manifest = {
			server: {
				mcp_config: {
					command: "node",
					args: [
						// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template strings for testing
						"${__dirname}/server.js",
						// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
						"--config=${user_config.configPath}",
					],
					env: {
						// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template strings for testing
						API_KEY: "${user_config.apiKey}",
						DATABASE_URL:
							// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
							"${user_config.database.host}:${user_config.database.port}",
						// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
						LOG_FILE: "${__dirname}/logs/app.log",
					},
				},
			},
		}

		const manifestPath = join(tempDir, "manifest.json")
		await writeFile(manifestPath, JSON.stringify(manifest))

		const userConfig = {
			apiKey: "secret123",
			configPath: "/custom/config.json",
			database: { host: "localhost", port: 5432 },
		}

		// Test the complete flow: getBundleCommand -> hydrateBundleCommand
		// Bundle is assumed to already be installed (tempDir simulates bundle directory)
		const hydrated = getHydratedBundleCommand(tempDir, userConfig)

		expect(hydrated.command).toBe("node")
		expect(hydrated.args).toEqual([
			`${tempDir}/server.js`,
			"--config=/custom/config.json",
		])
		expect(hydrated.env).toEqual({
			API_KEY: "secret123",
			DATABASE_URL: "localhost:5432",
			LOG_FILE: `${tempDir}/logs/app.log`,
		})
	})
})
