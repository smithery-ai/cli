import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	getBundleCommand,
	getHydratedBundleCommand,
	hydrateBundleCommand,
} from "../../mcpb.js"

describe("Bundle Manager End-to-End", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = `/tmp/bundle-manager-test-${Date.now()}`
		await mkdir(tempDir, { recursive: true })
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
						"${__dirname}/server.js",
						"--config=${user_config.configPath}",
					],
					env: {
						API_KEY: "${user_config.apiKey}",
						DATABASE_URL:
							"${user_config.database.host}:${user_config.database.port}",
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
						"${__dirname}/server.js",
						"--config=${user_config.configPath}",
					],
					env: {
						API_KEY: "${user_config.apiKey}",
						DATABASE_URL:
							"${user_config.database.host}:${user_config.database.port}",
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
