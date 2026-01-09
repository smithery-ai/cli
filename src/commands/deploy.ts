import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Smithery } from "@smithery/api"
import type { DeploymentRetrieveResponse } from "@smithery/api/resources/servers/deployments"
import type { DeployPayload } from "@smithery/sdk/bundle"
import chalk from "chalk"
import cliSpinners from "cli-spinners"
import ora from "ora"
import { buildDeployBundle } from "../lib/bundle.js"
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
async function getUserNamespaces(
	baseURL: string,
	apiKey: string,
): Promise<string[]> {
	const response = await fetch(`${baseURL}/namespaces`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
	})

	if (!response.ok) {
		if (response.status === 401) {
			throw new Error("Unauthorized: Invalid API key")
		}
		throw new Error(
			`Failed to fetch namespaces: ${response.status} ${response.statusText}`,
		)
	}

	const data = (await response.json()) as {
		namespaces: Array<{ name: string }>
	}
	return data.namespaces.map((ns) => ns.name)
}

/**
 * Create a new namespace via the registry API
 */
async function createNamespace(
	baseURL: string,
	apiKey: string,
	name: string,
): Promise<void> {
	const response = await fetch(`${baseURL}/namespaces`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ name }),
	})

	if (!response.ok) {
		const errorData = (await response.json().catch(() => ({}))) as {
			error?: string
		}
		const errorMessage = errorData.error || response.statusText

		if (response.status === 401) {
			throw new Error("Unauthorized: Invalid API key")
		}
		if (response.status === 409) {
			throw new Error(`Namespace already exists: ${errorMessage}`)
		}
		if (response.status === 400) {
			throw new Error(`Invalid namespace name: ${errorMessage}`)
		}
		throw new Error(`Failed to create namespace: ${errorMessage}`)
	}
}

export async function deploy(options: DeployOptions = {}) {
	const apiKey = await ensureApiKey(options.key)
	const registryEndpoint =
		process.env.REGISTRY_ENDPOINT || "https://api.smithery.ai"
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
			const userNamespaces = await getUserNamespaces(registryEndpoint, apiKey)
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
				await createNamespace(registryEndpoint, apiKey, newNamespaceName)
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

	// Determine deploy type: --url flag means external
	const externalUrl = options.url
	const isExternal = !!externalUrl

	console.log(
		chalk.cyan(
			`\nDeploying ${chalk.bold(serverName)} (${isExternal ? "external" : "hosted"}) to Smithery Registry...`,
		),
	)

	let payload: DeployPayload
	let moduleContent: string | undefined
	let sourcemapContent: string | undefined

	if (isExternal) {
		payload = { type: "external", upstreamUrl: externalUrl }
	} else {
		const { outDir, payload: hostedPayload } = await buildDeployBundle({
			entryFile: options.entryFile,
			production: true,
		})

		const userModulePath = join(outDir, "user-module.js")
		if (!existsSync(userModulePath)) {
			throw new Error(`Bundle user module not found at ${userModulePath}`)
		}

		payload = hostedPayload
		moduleContent = readFileSync(userModulePath, "utf-8")

		const sourcemapPath = join(outDir, "user-module.js.map")
		if (existsSync(sourcemapPath)) {
			sourcemapContent = readFileSync(sourcemapPath, "utf-8")
		}
	}

	const uploadSpinner = ora({
		text: "Uploading deployment...",
		spinner: cliSpinners.star,
		color: "yellow",
	}).start()

	try {
		const result = await registry.servers.deployments.deploy(serverName, {
			payload: JSON.stringify(payload),
			module: moduleContent,
			sourcemap: sourcemapContent,
		})

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
			console.log(`${chalk.bold("Deployment ID:")} ${deploymentId}`)
			console.log(`${chalk.bold("MCP URL:")}       ${chalk.cyan(data.mcpUrl)}`)
			console.log(
				`${chalk.bold("Server Page:")}  ${chalk.cyan(`https://smithery.ai/server/${serverName}`)}`,
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
