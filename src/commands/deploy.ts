import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { SmitheryRegistry } from "@smithery/registry"
import type { DeploymentLogEntry } from "@smithery/registry/models/components"
import type { DeployPayload } from "@smithery/sdk/bundle"
import chalk from "chalk"
import { buildDeployBundle } from "../lib/bundle.js"
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
	if (!registryEndpoint) {
		throw new Error(
			"Missing REGISTRY_ENDPOINT environment variable. This should have been injected during build.",
		)
	}
	return new SmitheryRegistry({
		bearerAuth: apiKey,
		serverURL: registryEndpoint,
	})
}

/** Parse a qualified name into namespace and name parts */
function parseQualifiedName(qualifiedName: string): {
	namespace: string
	name: string
} {
	const parts = qualifiedName.split("/")
	if (parts.length === 2) {
		return { namespace: parts[0], name: parts[1] }
	}
	// Single-segment QN: namespace is empty
	return { namespace: "", name: qualifiedName }
}

export async function deploy(options: DeployOptions = {}) {
	const apiKey = await ensureApiKey(options.key)

	const serverName = options.name
	if (!serverName) {
		console.error(
			chalk.red("Error: Server name is required."),
			"\n\nProvide it via:",
			"\n  --name @owner/name",
		)
		process.exit(1)
	}

	// Validate server name format: @owner/name or just name (un-namespaced)
	if (!/^(@?[\w-]+\/)?[\w-]+$/.test(serverName)) {
		console.error(
			chalk.red(`Invalid server name: ${serverName}`),
			"\nMust be in format @owner/name or name",
		)
		process.exit(1)
	}

	const registry = createRegistry(apiKey)
	const { namespace, name } = parseQualifiedName(serverName)

	if (options.resume) {
		console.log(chalk.cyan(`\nResuming latest deployment for ${serverName}...`))
		console.log(
			chalk.dim(
				`> Track progress at: https://smithery.ai/server/${serverName}/deployments`,
			),
		)

		const resumeResult = await registry.servers.resumeDeployment({
			namespace,
			name,
			id: "latest",
		})

		await pollDeployment(
			registry,
			serverName,
			namespace,
			name,
			resumeResult.deploymentId,
		)
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

	console.log(chalk.dim("> Uploading deployment..."))

	try {
		const deployRequest = {
			namespace,
			name,
			deployRequest: {
				payload: JSON.stringify(payload),
				module: moduleContent,
				sourcemap: sourcemapContent,
			},
		}
		if (process.argv.includes("--debug")) {
			console.log(
				chalk.dim(
					`> SDK request: ${JSON.stringify({ namespace, name, hasModule: !!moduleContent })}`,
				),
			)
		}
		const result = await registry.servers.deploy(deployRequest)

		console.log(
			chalk.dim(
				`> Deployment ${result.deploymentId} accepted. Waiting for completion...`,
			),
		)
		console.log(
			chalk.dim(
				`> Track progress at: https://smithery.ai/server/${serverName}/deployments`,
			),
		)

		await pollDeployment(
			registry,
			serverName,
			namespace,
			name,
			result.deploymentId,
		)
	} catch (error) {
		if (error instanceof Error) {
			throw error
		}
		// SDK errors may not be Error instances - extract message
		const errorObj = error as { message?: string; body$?: string }
		const message = errorObj.message || errorObj.body$ || JSON.stringify(error)
		throw new Error(message)
	}
}

async function pollDeployment(
	registry: SmitheryRegistry,
	serverName: string,
	namespace: string,
	name: string,
	deploymentId: string,
) {
	let lastLoggedIndex = 0

	while (true) {
		const data = await registry.servers.getDeploymentStatus({
			namespace,
			name,
			id: deploymentId,
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
			console.log(chalk.green("\n✅ Deployment successful!"))
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
				await registry.servers.resumeDeployment({
					namespace,
					name,
					id: deploymentId,
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
				(l: DeploymentLogEntry) => l.level === "error",
			)
			const errorMessage = errorLog?.message || "Deployment failed"
			console.error(chalk.red(`\n❌ Deployment failed: ${errorMessage}`))

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
