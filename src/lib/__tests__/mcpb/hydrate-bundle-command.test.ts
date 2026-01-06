import { describe, expect, it } from "vitest"
import { hydrateBundleCommand } from "../../mcpb.js"
import {
	bundleCommandWithBothTemplates,
	bundleCommandWithDirname,
	bundleCommandWithMissingConfig,
	bundleCommandWithNestedConfig,
	bundleCommandWithoutEnv,
	bundleCommandWithPlainStrings,
	bundleCommandWithUserConfig,
	bundleDir,
	userConfigEmpty,
	userConfigNested,
	userConfigSimple,
} from "../fixtures/bundle-commands.js"

describe("hydrateBundleCommand", () => {
	it("resolves __dirname in args", () => {
		// Arrange: bundleCommand with "${__dirname}/bin" in args
		const bundleCommand = bundleCommandWithDirname
		const userConfig = userConfigEmpty
		const dir = bundleDir

		// Act: hydrateBundleCommand(bundleCommand, {}, "/path/to/bundle")
		const result = hydrateBundleCommand(bundleCommand, userConfig, dir)

		// Assert: args contains "/path/to/bundle/bin"
		expect(result.args).toEqual([`${dir}/bin`])
		expect(result.command).toBe("node")
		expect(result.env).toEqual({})
	})

	it("resolves user_config templates in env vars", () => {
		// Arrange: bundleCommand with env: {API_KEY: "${user_config.apiKey}"}
		const bundleCommand = bundleCommandWithUserConfig
		const userConfig = userConfigSimple
		const dir = bundleDir

		// Act: hydrateBundleCommand(bundleCommand, {apiKey: "sk-123"}, bundleDir)
		const result = hydrateBundleCommand(bundleCommand, userConfig, dir)

		// Assert: env.API_KEY === "sk-123"
		expect(result.env).toEqual({
			API_KEY: "sk-123",
		})
		expect(result.command).toBe("node")
		expect(result.args).toEqual([])
	})

	it("resolves templates in both args and env simultaneously", () => {
		// Arrange: bundleCommand with templates in both args and env
		const bundleCommand = bundleCommandWithBothTemplates
		const userConfig = {
			apiKey: "sk-123",
			database: {
				host: "localhost",
				port: 5432,
			},
		}
		const dir = bundleDir

		// Act: hydrateBundleCommand(bundleCommand, userConfig, bundleDir)
		const result = hydrateBundleCommand(bundleCommand, userConfig, dir)

		// Assert: both args and env have resolved values
		expect(result.args).toEqual([`${dir}/server.js`, "--api-key=sk-123"])
		expect(result.env).toEqual({
			API_KEY: "sk-123",
			DATABASE_URL: "localhost:5432",
		})
		expect(result.command).toBe("node")
	})

	it("returns empty env object when bundleCommand.env is undefined", () => {
		// Arrange: bundleCommand without env property
		const bundleCommand = bundleCommandWithoutEnv
		const userConfig = userConfigEmpty
		const dir = bundleDir

		// Act: hydrateBundleCommand(bundleCommand, {}, bundleDir)
		const result = hydrateBundleCommand(bundleCommand, userConfig, dir)

		// Assert: result.env is empty object {}
		expect(result.env).toEqual({})
		expect(result.args).toEqual([`${dir}/server.js`])
		expect(result.command).toBe("node")
	})

	it("preserves unresolved templates when config path not found", () => {
		// Arrange: bundleCommand with "${user_config.missing}" in env
		const bundleCommand = bundleCommandWithMissingConfig
		const userConfig = userConfigEmpty
		const dir = bundleDir

		// Act: hydrateBundleCommand(bundleCommand, {}, bundleDir)
		const result = hydrateBundleCommand(bundleCommand, userConfig, dir)

		// Assert: env value still contains "${user_config.missing}"
		expect(result.env).toEqual({
			// biome-ignore lint/suspicious/noTemplateCurlyInString: Literal template string for testing
			MISSING: "${user_config.missing}",
		})
		expect(result.command).toBe("node")
		expect(result.args).toEqual([])
	})

	it("passes through non-template strings unchanged", () => {
		// Arrange: bundleCommand with plain strings in args and env
		const bundleCommand = bundleCommandWithPlainStrings
		const userConfig = userConfigEmpty
		const dir = bundleDir

		// Act: hydrateBundleCommand(bundleCommand, {}, bundleDir)
		const result = hydrateBundleCommand(bundleCommand, userConfig, dir)

		// Assert: strings unchanged
		expect(result.args).toEqual(["server.js", "--port=3000"])
		expect(result.env).toEqual({
			NODE_ENV: "production",
			PORT: "3000",
		})
		expect(result.command).toBe("node")
	})

	it("resolves nested user_config paths", () => {
		// Arrange: bundleCommand with "${user_config.db.host}" in env
		const bundleCommand = bundleCommandWithNestedConfig
		const userConfig = userConfigNested
		const dir = bundleDir

		// Act: hydrateBundleCommand(bundleCommand, {db: {host: "localhost"}}, bundleDir)
		const result = hydrateBundleCommand(bundleCommand, userConfig, dir)

		// Assert: env value === "localhost"
		expect(result.env).toEqual({
			DB_HOST: "localhost",
		})
		expect(result.command).toBe("node")
		expect(result.args).toEqual([])
	})

	it("passes command through without modification", () => {
		// Arrange: bundleCommand with command: "node"
		const bundleCommand = {
			command: "node",
			args: [],
			env: undefined,
		}
		const userConfig = userConfigEmpty
		const dir = bundleDir

		// Act: hydrateBundleCommand(bundleCommand, {}, bundleDir)
		const result = hydrateBundleCommand(bundleCommand, userConfig, dir)

		// Assert: result.command === "node"
		expect(result.command).toBe("node")
		expect(result.args).toEqual([])
		expect(result.env).toEqual({})
	})
})
