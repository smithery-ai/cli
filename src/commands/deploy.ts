import { createReadStream, existsSync } from "node:fs"
import { Smithery } from "@smithery/api"
import type {
	DeploymentRetrieveResponse,
	DeployPayload,
} from "@smithery/api/resources/servers/deployments"
import chalk from "chalk"
import { buildBundle } from "../lib/bundle"
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

	console.log(chalk.dim("> Uploading deployment..."))

	const result = await registry.servers.deployments.deploy(serverName, {
		payload: JSON.stringify(payload),
		module: moduleFile,
		sourcemap: sourcemapFile,
		bundle: bundleFile,
	})

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

	await pollDeployment(registry, serverName, result.deploymentId)
}

async function pollDeployment(
	registry: Smithery,
	serverName: string,
	deploymentId: string,
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
