import { createReadStream, existsSync } from "node:fs"
import { Smithery } from "@smithery/api"
import type {
	DeploymentDeployParams,
	DeploymentRetrieveResponse,
} from "@smithery/api/resources/servers/deployments"
import chalk from "chalk"
import cliSpinners from "cli-spinners"
import ora from "ora"
import { buildBundle, type DeployPayload } from "../lib/bundle/index.js"
import { createError } from "../lib/errors.js"
import {
	promptForNamespaceCreation,
	promptForNamespaceSelection,
	promptForServerNameInput,
} from "../utils/command-prompts.js"
import { ensureApiKey } from "../utils/runtime.js"

interface DeployOptions {
	entryFile?: string
	key?: string
	name?: string
	url?: string
	resume?: boolean
	transport?: "shttp" | "stdio"
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function createRegistry(apiKey: string) {
	const registryEndpoint = process.env.REGISTRY_ENDPOINT
	return new Smithery({
		apiKey,
		baseURL: registryEndpoint || "https://api.smithery.ai",
	})
}

/**
 * Parse a qualified name into namespace and server name parts.
 * Handles formats: namespace/serverName, @namespace/serverName, or serverName
 */
function parseQualifiedName(qualifiedName: string): {
	namespace: string
	serverName: string
} {
	// Strip @ prefix if present
	const normalized = qualifiedName.startsWith("@")
		? qualifiedName.slice(1)
		: qualifiedName

	const parts = normalized.split("/")
	if (parts.length === 2) {
		return { namespace: parts[0], serverName: parts[1] }
	}
	// Single-segment QN: namespace is empty
	return { namespace: "", serverName: normalized }
}

/**
 * Get user's namespaces from the registry API
 */
async function getUserNamespaces(client: Smithery): Promise<string[]> {
	try {
		const response = await client.namespaces.list()
		return response.namespaces.map((ns) => ns.name)
	} catch (error) {
		throw createError(error, "Failed to fetch namespaces")
	}
}

/**
 * Create a new namespace via the registry API
 */
async function createNamespace(client: Smithery, name: string): Promise<void> {
	try {
		await client.namespaces.create({ name })
	} catch (error) {
		throw createError(error, "Failed to create namespace")
	}
}

export async function deploy(options: DeployOptions = {}) {
	const apiKey = await ensureApiKey(options.key)
	const registry = createRegistry(apiKey)

	let serverName = options.name

	// If --name is not provided, run interactive flow
	if (!serverName) {
		console.log(chalk.cyan("Deploying to Smithery Registry..."))

		try {
			// Get user's namespaces
			const spinner = ora({
				text: "Fetching namespaces...",
				spinner: cliSpinners.star,
				color: "yellow",
			}).start()
			const userNamespaces = await getUserNamespaces(registry)
			spinner.succeed(
				chalk.dim(
					`Found ${userNamespaces.length} namespace${userNamespaces.length === 1 ? "" : "s"}`,
				),
			)

			let namespace: string

			if (userNamespaces.length === 0) {
				// No namespaces - prompt to create one
				console.log(
					chalk.yellow("No namespaces found. Creating a new namespace..."),
				)
				const newNamespaceName = await promptForNamespaceCreation()
				await createNamespace(registry, newNamespaceName)
				namespace = newNamespaceName
				console.log(chalk.green(`✓ Created namespace: ${namespace}`))
			} else if (userNamespaces.length === 1) {
				// Single namespace - use it automatically
				namespace = userNamespaces[0]
				console.log(chalk.dim(`Using namespace: ${chalk.cyan(namespace)}`))
			} else {
				// Multiple namespaces - prompt to select
				namespace = await promptForNamespaceSelection(userNamespaces)
			}

			// Prompt for server name
			const serverNameInput = await promptForServerNameInput(namespace)
			serverName = namespace
				? `${namespace}/${serverNameInput}`
				: serverNameInput
		} catch (error) {
			console.error(
				chalk.red("Error during interactive setup:"),
				error instanceof Error ? error.message : String(error),
			)
			process.exit(1)
		}
	}

	if (options.resume) {
		console.log(chalk.cyan(`\nResuming latest deployment for ${serverName}...`))
		console.log(
			chalk.dim(
				`> Track progress at: https://smithery.ai/server/${serverName}/deployments`,
			),
		)

		const resumeResult = await registry.servers.deployments.resume("latest", {
			qualifiedName: serverName,
		})

		await pollDeployment(registry, serverName, resumeResult.deploymentId)
		return
	}

	// Determine deploy type
	const transport = options.transport || "shttp"
	const externalUrl = options.url
	const isExternal = !!externalUrl
	const isStdio = transport === "stdio"

	// Reject --url with --transport stdio (incompatible)
	if (isExternal && isStdio) {
		console.error(
			chalk.red("Error: --url cannot be used with --transport stdio"),
		)
		process.exit(1)
	}

	const deployType = isExternal ? "external" : isStdio ? "stdio" : "hosted"
	console.log(
		chalk.cyan(
			`\nDeploying ${chalk.bold(serverName)} (${deployType}) to Smithery Registry...`,
		),
	)

	let payload: DeployPayload
	let moduleFile: ReturnType<typeof createReadStream> | undefined
	let sourcemapFile: ReturnType<typeof createReadStream> | undefined
	let bundleFile: ReturnType<typeof createReadStream> | undefined

	if (isExternal) {
		// External deployments don't need a build
		payload = { type: "external", upstreamUrl: externalUrl }
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
			bundleFile = createReadStream(buildResult.mcpbFile)
		} else {
			// For shttp, read the module and sourcemap
			if (!existsSync(buildResult.moduleFile)) {
				throw new Error(`Bundle module not found at ${buildResult.moduleFile}`)
			}
			moduleFile = createReadStream(buildResult.moduleFile)

			if (buildResult.sourcemapFile && existsSync(buildResult.sourcemapFile)) {
				sourcemapFile = createReadStream(buildResult.sourcemapFile)
			}
		}
	}

	const uploadSpinner = ora({
		text: "Uploading deployment...",
		spinner: cliSpinners.star,
		color: "yellow",
	}).start()

	try {
		const deployParams: DeploymentDeployParams = {
			payload: JSON.stringify(payload),
			module: moduleFile,
			sourcemap: sourcemapFile,
			bundle: bundleFile,
		}
		const result = await registry.servers.deployments.deploy(
			serverName,
			deployParams,
		)

		uploadSpinner.stop()
		console.log(chalk.dim(`✓ Deployment ${result.deploymentId} accepted`))

		console.log(chalk.dim("> Waiting for completion..."))
		console.log(
			chalk.dim(
				`> Track progress at: https://smithery.ai/server/${serverName}/deployments`,
			),
		)

		await pollDeployment(registry, serverName, result.deploymentId, isExternal)
	} catch (error) {
		uploadSpinner.fail("Upload failed")
		// Handle HTTP errors with status codes
		const errorObj = error as {
			message?: string
			body$?: string
			status?: number
			statusCode?: number
		}

		const status = errorObj.status || errorObj.statusCode

		if (status === 403) {
			const { namespace } = parseQualifiedName(serverName)
			const errorMessage = errorObj.body$ || errorObj.message || "Forbidden"
			if (errorMessage.includes("namespace")) {
				console.error(
					chalk.red(`\n✗ Error: You don't own the namespace "${namespace}".`),
				)
				console.error(
					chalk.dim(
						"   Namespaces can only be used by their owners. Please use a namespace you own or create a new one.",
					),
				)
			} else {
				console.error(
					chalk.red(`\n✗ Error: You don't own the server "${serverName}".`),
				)
				console.error(
					chalk.dim(
						"   Servers can only be deployed by their owners. Please use a server name you own.",
					),
				)
			}
			process.exit(1)
		}

		if (status === 404) {
			const errorMessage = errorObj.body$ || errorObj.message || "Not found"
			if (errorMessage.includes("namespace")) {
				const { namespace } = parseQualifiedName(serverName)
				console.error(
					chalk.red(`\n✗ Error: Namespace "${namespace}" not found.`),
				)
				console.error(
					chalk.dim(
						"   The namespace doesn't exist. Please create it first or use a different namespace.",
					),
				)
			} else {
				console.error(chalk.red(`\n✗ Error: Server "${serverName}" not found.`))
			}
			process.exit(1)
		}

		// Handle other errors
		if (error instanceof Error) {
			throw error
		}
		// SDK errors may not be Error instances - extract message
		const message = errorObj.message || errorObj.body$ || JSON.stringify(error)
		throw new Error(message)
	}
}

async function pollDeployment(
	registry: Smithery,
	serverName: string,
	deploymentId: string,
	isExternal = false,
) {
	let lastLoggedIndex = 0

	while (true) {
		const data = await registry.servers.deployments.retrieve(deploymentId, {
			qualifiedName: serverName,
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

			if (isExternal) {
				return
			}

			if (process.stdin.isTTY) {
				console.log(
					chalk.dim("\nPress Enter once you have authorized to resume..."),
				)
				await new Promise<void>((resolve) => {
					process.stdin.resume()
					process.stdin.once("data", () => {
						process.stdin.pause()
						resolve()
					})
				})

				console.log(chalk.cyan("\nResuming deployment..."))
				await registry.servers.deployments.resume(deploymentId, {
					qualifiedName: serverName,
				})

				await sleep(2000)
				continue
			}
			console.log(
				`Then run: ${chalk.bold(`smithery deploy --resume --name ${serverName}`)}`,
			)
			return
		}

		if (
			["FAILURE", "FAILURE_SCAN", "INTERNAL_ERROR", "CANCELLED"].includes(
				data.status,
			)
		) {
			const errorLog = data.logs?.find(
				(l: DeploymentRetrieveResponse.Log) => l.level === "error",
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
