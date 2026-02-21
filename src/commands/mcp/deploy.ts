import { createReadStream } from "node:fs"
import { NotFoundError, type Smithery } from "@smithery/api"
import type {
	DeployPayload,
	ReleaseDeployParams,
	ReleaseGetResponse,
} from "@smithery/api/resources/servers/releases"
import chalk from "chalk"
import cliSpinners from "cli-spinners"
import ora from "ora"
import { buildBundle, loadBuildManifest } from "../../lib/bundle/index.js"
import { fatal } from "../../lib/cli-error"
import { loadProjectConfig } from "../../lib/config-loader.js"
import { resolveNamespace } from "../../lib/namespace.js"
import { createSmitheryClientSync } from "../../lib/smithery-client"
import { parseConfigSchema } from "../../utils/cli-utils.js"
import { promptForServerNameInput } from "../../utils/command-prompts.js"
import { ensureApiKey } from "../../utils/runtime.js"

interface DeployOptions {
	entryFile?: string
	name?: string // CLI option name, internally mapped to qualifiedName
	url?: string
	resume?: boolean
	configSchema?: string // JSON string or path to .json file
	fromBuild?: string // Path to pre-built artifacts directory
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function deploy(options: DeployOptions = {}) {
	const apiKey = await ensureApiKey()
	const registry = createSmitheryClientSync(apiKey)

	// Validate --from-build constraints
	if (options.fromBuild) {
		if (options.entryFile || options.url) {
			console.error(
				chalk.red(
					"Error: --from-build cannot be combined with an entry file or URL",
				),
			)
			process.exit(1)
		}
	}

	// Map CLI option 'name' to internal 'qualifiedName' for clarity
	let qualifiedName = options.name

	// If --name is not provided, run interactive flow
	if (!qualifiedName) {
		console.log(chalk.cyan("Publishing to Smithery Registry..."))

		try {
			// Resolve server name from build manifest or smithery.yaml
			let configServerName: string | undefined
			if (options.fromBuild) {
				const artifacts = loadBuildManifest(options.fromBuild)
				configServerName = artifacts.name
			} else {
				const projectConfig = loadProjectConfig()
				configServerName =
					projectConfig &&
					projectConfig.runtime === "typescript" &&
					typeof projectConfig.name === "string"
						? projectConfig.name
						: undefined
			}

			// Resolve namespace through interactive flow
			const namespace = await resolveNamespace(registry)

			// If name exists in config/manifest, use it directly without prompting
			if (configServerName) {
				const source = options.fromBuild ? "build manifest" : "smithery.yaml"
				console.log(
					chalk.dim(
						`Using server name "${chalk.cyan(configServerName)}" from ${source}`,
					),
				)
				qualifiedName = namespace
					? `${namespace}/${configServerName}`
					: configServerName
			} else {
				// Prompt for server name if not found in config/manifest
				const serverNameInput = await promptForServerNameInput(namespace)
				qualifiedName = namespace
					? `${namespace}/${serverNameInput}`
					: serverNameInput
			}
		} catch (error) {
			fatal("Error during interactive setup", error)
		}
	}

	if (!qualifiedName) {
		console.error(chalk.red("Error: Server name is required"))
		process.exit(1)
	}

	if (options.resume) {
		console.log(chalk.cyan(`\nResuming latest release for ${qualifiedName}...`))
		console.log(
			chalk.dim(
				`> Track progress at: https://smithery.ai/servers/${qualifiedName}/releases`,
			),
		)

		const resumeResult = await registry.servers.releases.resume("latest", {
			qualifiedName,
		})

		await pollDeployment(registry, qualifiedName, resumeResult.deploymentId)
		return
	}

	const externalUrl = options.url
	const isExternal = !!externalUrl

	if (options.configSchema && !isExternal) {
		console.error(
			chalk.red(
				"Error: --config-schema can only be used when publishing a URL",
			),
		)
		process.exit(1)
	}

	let payload: DeployPayload
	let modulePath: string | undefined
	let sourcemapPath: string | undefined
	let bundlePath: string | undefined

	if (isExternal) {
		// External deployments — no build, no manifest
		const configSchema = options.configSchema
			? parseConfigSchema(options.configSchema)
			: undefined

		payload = {
			type: "external",
			upstreamUrl: externalUrl,
			...(configSchema && { configSchema }),
		}
	} else {
		// Resolve build directory — either pre-built or build inline
		let buildDir: string
		if (options.fromBuild) {
			buildDir = options.fromBuild
		} else {
			// Warn if assets configured (assets only supported via `build --transport stdio`)
			const projectConfig = loadProjectConfig()
			if (projectConfig?.build?.assets?.length) {
				console.log(
					chalk.yellow(
						"\nWarning: build.assets is only supported with `smithery mcp build --transport stdio`. Assets will be ignored.",
					),
				)
			}

			buildDir = await buildBundle({
				entryFile: options.entryFile,
				transport: "shttp",
				production: true,
			})
		}

		// Always load from manifest — single path for both pre-built and inline
		const artifacts = loadBuildManifest(buildDir)
		payload = artifacts.payload
		modulePath = artifacts.modulePath
		sourcemapPath = artifacts.sourcemapPath
		bundlePath = artifacts.bundlePath
	}

	const deployType =
		payload.type === "external"
			? "external"
			: payload.type === "stdio"
				? "stdio"
				: "hosted"
	console.log(
		chalk.cyan(
			`\nPublishing ${chalk.bold(qualifiedName)} (${deployType}) to Smithery Registry...`,
		),
	)

	await deployWithAutoCreate(
		registry,
		qualifiedName,
		payload,
		modulePath,
		sourcemapPath,
		bundlePath,
	)
}

function isNotFoundError(error: unknown): boolean {
	if (error instanceof NotFoundError) return true
	if (error instanceof Error && error.name === "NotFoundError") return true
	return false
}

function getApiErrorDetail(error: unknown): string {
	const err = error as { error?: { error?: string }; message?: string }
	return err.error?.error || err.message || "Not found"
}

async function deployToServer(
	registry: Smithery,
	qualifiedName: string,
	payload: DeployPayload,
	moduleFile?: ReturnType<typeof createReadStream>,
	sourcemapFile?: ReturnType<typeof createReadStream>,
	bundleFile?: ReturnType<typeof createReadStream>,
) {
	const uploadSpinner = ora({
		text: "Uploading release...",
		spinner: cliSpinners.star,
		color: "yellow",
	}).start()

	const deployParams: ReleaseDeployParams = {
		payload: JSON.stringify(payload),
		module: moduleFile,
		sourcemap: sourcemapFile,
		bundle: bundleFile,
	}
	let result: Awaited<ReturnType<typeof registry.servers.releases.deploy>>
	try {
		result = await registry.servers.releases.deploy(qualifiedName, deployParams)
	} catch (error) {
		uploadSpinner.stop()
		throw error
	}

	uploadSpinner.stop()
	console.log(chalk.dim(`✓ Release ${result.deploymentId} accepted`))

	console.log(chalk.dim("> Waiting for completion..."))
	console.log(
		chalk.dim(
			`> Track progress at: https://smithery.ai/servers/${qualifiedName}/releases`,
		),
	)

	await pollDeployment(registry, qualifiedName, result.deploymentId)
}

function createStreams(
	modulePath?: string,
	sourcemapPath?: string,
	bundlePath?: string,
) {
	return {
		moduleFile: modulePath ? createReadStream(modulePath) : undefined,
		sourcemapFile: sourcemapPath ? createReadStream(sourcemapPath) : undefined,
		bundleFile: bundlePath ? createReadStream(bundlePath) : undefined,
	}
}

async function deployWithAutoCreate(
	registry: Smithery,
	qualifiedName: string,
	payload: DeployPayload,
	modulePath?: string,
	sourcemapPath?: string,
	bundlePath?: string,
) {
	try {
		const { moduleFile, sourcemapFile, bundleFile } = createStreams(
			modulePath,
			sourcemapPath,
			bundlePath,
		)
		await deployToServer(
			registry,
			qualifiedName,
			payload,
			moduleFile,
			sourcemapFile,
			bundleFile,
		)
	} catch (error) {
		if (!isNotFoundError(error)) {
			fatal("Deployment failed", error)
		}

		const errorMessage = getApiErrorDetail(error)

		// Namespace not found — can't auto-create
		if (errorMessage.toLowerCase().includes("namespace")) {
			const ns = qualifiedName.split("/")[0]
			console.error(chalk.red(`\n✗ Error: Namespace "${ns}" not found.`))
			console.error(
				chalk.dim(
					"   The namespace doesn't exist. Please create it first or use a different namespace.",
				),
			)
			process.exit(1)
		}

		// Server not found — confirm in interactive mode, auto-create otherwise
		if (process.stdout.isTTY) {
			const inquirer = (await import("inquirer")).default
			const { confirmed } = await inquirer.prompt([
				{
					type: "confirm",
					name: "confirmed",
					message: `Server "${qualifiedName}" doesn't exist yet. Create it?`,
					default: true,
				},
			])
			if (!confirmed) return
		}

		await registry.servers.create(qualifiedName)
		console.log(chalk.dim(`✓ Created server "${qualifiedName}"`))

		// Retry the deploy with fresh streams
		const streams = createStreams(modulePath, sourcemapPath, bundlePath)
		await deployToServer(
			registry,
			qualifiedName,
			payload,
			streams.moduleFile,
			streams.sourcemapFile,
			streams.bundleFile,
		)
	}
}

async function pollDeployment(
	registry: Smithery,
	qualifiedName: string,
	deploymentId: string,
) {
	let lastLoggedIndex = 0

	while (true) {
		const data = await registry.servers.releases.get(deploymentId, {
			qualifiedName,
		})

		// Log new logs
		if (data.logs && data.logs.length > lastLoggedIndex) {
			for (let i = lastLoggedIndex; i < data.logs.length; i++) {
				const log = data.logs[i]
				if (log.message === "auth_required") continue
				const color = log.level === "error" ? chalk.red : chalk.white
				console.log(`${chalk.dim(`[${log.stage}]`)} ${color(log.message)}`)
			}
			lastLoggedIndex = data.logs.length
		}

		if (data.status === "SUCCESS") {
			console.log(chalk.green("\n✓ Release successful!"))
			console.log(chalk.dim(`${chalk.bold("Release ID:")} ${deploymentId}`))
			console.log(
				`  ${chalk.green(chalk.dim("➜"))}  ${chalk.bold(chalk.dim("MCP URL:"))}      ${chalk.cyan(data.mcpUrl)}`,
			)
			console.log(
				`  ${chalk.green("➜")}  ${chalk.bold("Server Page:")} ${chalk.cyan(`https://smithery.ai/servers/${qualifiedName}`)}`,
			)
			return
		}

		if (data.status === "AUTH_REQUIRED") {
			const authUrl = `https://smithery.ai/servers/${qualifiedName}/releases/`
			console.log(chalk.yellow("\n⚠ OAuth authorization required."))
			console.log(`Please authorize at: ${chalk.cyan(authUrl)}`)
			console.log(
				chalk.dim("Once authorized, release will automatically continue."),
			)
			return
		}

		if (
			["FAILURE", "FAILURE_SCAN", "INTERNAL_ERROR", "CANCELLED"].includes(
				data.status,
			)
		) {
			const errorLog = data.logs?.find(
				(l: ReleaseGetResponse.Log) => l.level === "error",
			)
			const errorMessage = errorLog?.message || "Release failed"
			console.error(chalk.red(`\n✗ Release failed: ${errorMessage}`))

			if (errorMessage.includes("timed out")) {
				console.error(chalk.yellow("\nTroubleshooting tips:"))
				console.error(
					chalk.dim("  • Verify your MCP server is running and accessible"),
				)
				console.error(chalk.dim("  • Check if the server URL is correct"))
				console.error(
					chalk.dim("  • Ensure there are no firewall/network issues"),
				)
			} else if (
				errorMessage.includes("auth_required") ||
				errorMessage.includes("Authentication")
			) {
				console.error(
					chalk.yellow("\nThe server requires OAuth authentication."),
				)
				console.error(
					chalk.dim(
						`  Visit: https://smithery.ai/servers/${qualifiedName}/releases`,
					),
				)
			}

			process.exit(1)
		}

		await sleep(2000)
	}
}
