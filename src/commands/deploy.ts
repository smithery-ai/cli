import { createReadStream, existsSync } from "node:fs"
import {
	NotFoundError,
	PermissionDeniedError,
	type Smithery,
} from "@smithery/api"
import type {
	DeploymentDeployParams,
	DeploymentGetResponse,
	DeploymentResumeParams,
	DeployPayload,
} from "@smithery/api/resources/servers/deployments"
import chalk from "chalk"
import cliSpinners from "cli-spinners"
import ora from "ora"
import { buildBundle } from "../lib/bundle/index.js"
import { loadProjectConfig } from "../lib/config-loader.js"
import { resolveNamespace } from "../lib/namespace.js"
import { createSmitheryClientSync } from "../lib/smithery-client"
import { parseConfigSchema, parseQualifiedName } from "../utils/cli-utils.js"
import { promptForServerNameInput } from "../utils/command-prompts.js"
import { ensureApiKey } from "../utils/runtime.js"

interface DeployOptions {
	entryFile?: string
	key?: string
	name?: string // CLI option name, internally mapped to qualifiedName
	url?: string
	resume?: boolean
	transport?: "shttp" | "stdio"
	configSchema?: string // JSON string or path to .json file
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function deploy(options: DeployOptions = {}) {
	const apiKey = await ensureApiKey(options.key)
	const registry = createSmitheryClientSync(apiKey)

	// Map CLI option 'name' to internal 'qualifiedName' for clarity
	let qualifiedName = options.name

	// If --name is not provided, run interactive flow
	if (!qualifiedName) {
		console.log(chalk.cyan("Deploying to Smithery Registry..."))

		try {
			// Load project config to get server name from smithery.yaml
			const projectConfig = loadProjectConfig()
			const configServerName =
				projectConfig &&
				projectConfig.runtime === "typescript" &&
				typeof projectConfig.name === "string"
					? projectConfig.name
					: undefined

			// Resolve namespace through interactive flow
			const namespace = await resolveNamespace(registry)

			// If name exists in config, use it directly without prompting
			if (configServerName) {
				console.log(
					chalk.dim(
						`Using server name "${chalk.cyan(configServerName)}" from smithery.yaml`,
					),
				)
				qualifiedName = namespace
					? `${namespace}/${configServerName}`
					: configServerName
			} else {
				// Prompt for server name if not found in config
				const serverNameInput = await promptForServerNameInput(namespace)
				qualifiedName = namespace
					? `${namespace}/${serverNameInput}`
					: serverNameInput
			}
		} catch (error) {
			console.error(
				chalk.red("Error during interactive setup:"),
				error instanceof Error ? error.message : String(error),
			)
			process.exit(1)
		}
	}

	if (!qualifiedName) {
		console.error(chalk.red("Error: Server name is required"))
		process.exit(1)
	}

	if (options.resume) {
		console.log(
			chalk.cyan(`\nResuming latest deployment for ${qualifiedName}...`),
		)
		console.log(
			chalk.dim(
				`> Track progress at: https://smithery.ai/server/${qualifiedName}/deployments`,
			),
		)

		const { namespace, serverName: server } = parseQualifiedName(qualifiedName)
		const resumeParams: DeploymentResumeParams = {
			namespace,
			server,
		}
		const resumeResult = await registry.servers.deployments.resume(
			"latest",
			resumeParams,
		)

		await pollDeployment(registry, qualifiedName, resumeResult.deploymentId)
		return
	}

	// Determine deploy type
	const transport = options.transport || "shttp"
	const externalUrl = options.url
	const isExternal = !!externalUrl
	const isStdio = transport === "stdio"

	// Reject URL publishing with --transport stdio (incompatible)
	if (isExternal && isStdio) {
		console.error(
			chalk.red("Error: URL publishing cannot be used with --transport stdio"),
		)
		process.exit(1)
	}

	// Reject --config-schema without a URL (only for external URLs)
	if (options.configSchema && !isExternal) {
		console.error(
			chalk.red(
				"Error: --config-schema can only be used when publishing a URL",
			),
		)
		process.exit(1)
	}

	const deployType = isExternal ? "external" : isStdio ? "stdio" : "hosted"
	console.log(
		chalk.cyan(
			`\nDeploying ${chalk.bold(qualifiedName)} (${deployType}) to Smithery Registry...`,
		),
	)

	// Warn if assets are configured but transport is not stdio
	const projectConfig = loadProjectConfig()
	if (projectConfig?.build?.assets?.length && !isStdio) {
		console.log(
			chalk.yellow(
				"\nWarning: build.assets is only supported for stdio transport. Assets will be ignored.",
			),
		)
	}

	let payload: DeployPayload
	let modulePath: string | undefined
	let sourcemapPath: string | undefined
	let bundlePath: string | undefined

	// Parse config schema if provided
	const configSchema = options.configSchema
		? parseConfigSchema(options.configSchema)
		: undefined

	if (isExternal) {
		// External deployments don't need a build
		payload = {
			type: "external",
			upstreamUrl: externalUrl,
			...(configSchema && { configSchema }),
		}
	} else {
		// Build the bundle (handles both shttp and stdio)
		const buildResult = await buildBundle({
			entryFile: options.entryFile,
			transport,
			production: true,
		})

		payload = buildResult.payload

		if (isStdio) {
			// For stdio, read the mcpb bundle
			if (!buildResult.mcpbFile || !existsSync(buildResult.mcpbFile)) {
				throw new Error("MCPB bundle not found after build")
			}
			bundlePath = buildResult.mcpbFile
		} else {
			// For shttp, read the module and sourcemap
			if (!existsSync(buildResult.moduleFile)) {
				throw new Error(`Bundle module not found at ${buildResult.moduleFile}`)
			}
			modulePath = buildResult.moduleFile

			if (buildResult.sourcemapFile && existsSync(buildResult.sourcemapFile)) {
				sourcemapPath = buildResult.sourcemapFile
			}
		}
	}

	const { namespace, serverName: server } = parseQualifiedName(qualifiedName)

	await deployWithAutoCreate(
		registry,
		server,
		namespace,
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
	server: string,
	namespace: string,
	qualifiedName: string,
	payload: DeployPayload,
	moduleFile?: ReturnType<typeof createReadStream>,
	sourcemapFile?: ReturnType<typeof createReadStream>,
	bundleFile?: ReturnType<typeof createReadStream>,
) {
	const uploadSpinner = ora({
		text: "Uploading deployment...",
		spinner: cliSpinners.star,
		color: "yellow",
	}).start()

	const deployParams: DeploymentDeployParams = {
		namespace,
		payload: JSON.stringify(payload),
		module: moduleFile,
		sourcemap: sourcemapFile,
		bundle: bundleFile,
	}
	let result: Awaited<ReturnType<typeof registry.servers.deployments.deploy>>
	try {
		result = await registry.servers.deployments.deploy(server, deployParams)
	} catch (error) {
		uploadSpinner.fail("Upload failed")
		throw error
	}

	uploadSpinner.stop()
	console.log(chalk.dim(`✓ Deployment ${result.deploymentId} accepted`))

	console.log(chalk.dim("> Waiting for completion..."))
	console.log(
		chalk.dim(
			`> Track progress at: https://smithery.ai/server/${qualifiedName}/deployments`,
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
	server: string,
	namespace: string,
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
			server,
			namespace,
			qualifiedName,
			payload,
			moduleFile,
			sourcemapFile,
			bundleFile,
		)
	} catch (error) {
		if (error instanceof PermissionDeniedError) {
			const errorBody = error.error as { error?: string } | undefined
			const errorMessage = errorBody?.error || "Forbidden"
			console.error(chalk.red(`\n✗ Error: ${errorMessage}`))
			process.exit(1)
		}

		if (isNotFoundError(error)) {
			const errorMessage = getApiErrorDetail(error)

			// Namespace not found — can't auto-create
			if (errorMessage.toLowerCase().includes("namespace")) {
				console.error(
					chalk.red(`\n✗ Error: Namespace "${namespace}" not found.`),
				)
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

			await registry.servers.create(server, { namespace })
			console.log(chalk.dim(`✓ Created server "${qualifiedName}"`))

			// Retry the deploy with fresh streams
			const streams = createStreams(modulePath, sourcemapPath, bundlePath)
			await deployToServer(
				registry,
				server,
				namespace,
				qualifiedName,
				payload,
				streams.moduleFile,
				streams.sourcemapFile,
				streams.bundleFile,
			)
			return
		}

		if (error instanceof Error) {
			throw error
		}
		throw new Error(JSON.stringify(error))
	}
}

async function pollDeployment(
	registry: Smithery,
	serverName: string,
	deploymentId: string,
) {
	let lastLoggedIndex = 0

	// Parse qualified name into namespace and server name
	const { namespace, serverName: server } = parseQualifiedName(serverName)

	while (true) {
		const data = await registry.servers.deployments.get(deploymentId, {
			namespace,
			server,
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
			console.log(chalk.green("\n✓ Deployment successful!"))
			console.log(chalk.dim(`${chalk.bold("Deployment ID:")} ${deploymentId}`))
			console.log(
				`  ${chalk.green(chalk.dim("➜"))}  ${chalk.bold(chalk.dim("MCP URL:"))}      ${chalk.cyan(data.mcpUrl)}`,
			)
			console.log(
				`  ${chalk.green("➜")}  ${chalk.bold("Server Page:")} ${chalk.cyan(`https://smithery.ai/server/${serverName}`)}`,
			)
			return
		}

		if (data.status === "AUTH_REQUIRED") {
			const authUrl = `https://smithery.ai/server/${serverName}/deployments/`
			console.log(chalk.yellow("\n⚠ OAuth authorization required."))
			console.log(`Please authorize at: ${chalk.cyan(authUrl)}`)
			console.log(
				chalk.dim("Once authorized, deployment will automatically continue."),
			)
			return
		}

		if (
			["FAILURE", "FAILURE_SCAN", "INTERNAL_ERROR", "CANCELLED"].includes(
				data.status,
			)
		) {
			const errorLog = data.logs?.find(
				(l: DeploymentGetResponse.Log) => l.level === "error",
			)
			const errorMessage = errorLog?.message || "Deployment failed"
			console.error(chalk.red(`\n✗ Deployment failed: ${errorMessage}`))

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
						`  Visit: https://smithery.ai/server/${serverName}/deployments`,
					),
				)
			}

			process.exit(1)
		}

		await sleep(2000)
	}
}
