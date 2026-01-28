import "../utils/suppress-punycode-warning"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { LoggingMessageNotificationSchema } from "@modelcontextprotocol/sdk/types.js"
import { APIConnectionTimeoutError } from "@smithery/api"
import chalk from "chalk"
import inquirer from "inquirer"
import ora from "ora"
import { debug, verbose } from "../lib/logger"
import { resolveServer } from "../lib/registry"
import { parseQualifiedName } from "../utils/cli-utils"
import { collectConfigValues } from "../utils/install/prompt-user-config"
import { getRuntimeEnvironment } from "../utils/runtime.js"

async function createClient() {
	const client = new Client(
		{ name: "smithery-cli", version: "1.0.0" },
		{ capabilities: {} },
	)
	client.setNotificationHandler(
		LoggingMessageNotificationSchema,
		(notification) => {
			debug(`[server log]: ${notification.params.data}`)
		},
	)
	return client
}

type Resource = Awaited<
	ReturnType<Client["listResources"]>
>["resources"][number]
type Tool = Awaited<ReturnType<Client["listTools"]>>["tools"][number]
type Prompt = Awaited<ReturnType<Client["listPrompts"]>>["prompts"][number]

type Primitive =
	| { type: "resource"; value: Resource }
	| { type: "tool"; value: Tool }
	| { type: "prompt"; value: Prompt }

type PrimitiveWithExit = Primitive | { type: "exit" }

async function listPrimitives(client: Client): Promise<Primitive[]> {
	const capabilities = client.getServerCapabilities() || {}
	const promises: Promise<Primitive[]>[] = []

	if (capabilities.resources) {
		promises.push(
			client
				.listResources()
				.then(({ resources }) =>
					resources.map((item) => ({ type: "resource" as const, value: item })),
				),
		)
	}

	if (capabilities.tools) {
		promises.push(
			client
				.listTools()
				.then(({ tools }) =>
					tools.map((item) => ({ type: "tool" as const, value: item })),
				),
		)
	}

	if (capabilities.prompts) {
		promises.push(
			client
				.listPrompts()
				.then(({ prompts }) =>
					prompts.map((item) => ({ type: "prompt" as const, value: item })),
				),
		)
	}

	const results = await Promise.all(promises)
	return results.flat()
}

async function connectServer(transport: StdioClientTransport) {
	const spinner = ora("Connecting to server...").start()
	let client: Client | null = null

	try {
		client = await createClient()
		await client.connect(transport)
		const primitives = await listPrimitives(client)

		spinner.succeed(
			`Connected, server capabilities: ${Object.keys(
				client.getServerCapabilities() || {},
			).join(", ")}`,
		)

		// Setup exit handlers
		const cleanup = async () => {
			console.error("Closing connection...")
			if (client) {
				await client.close()
			}
			process.exit(0)
		}

		// Handle exit signals
		process.on("SIGINT", cleanup)
		process.on("SIGTERM", cleanup)
		process.on("beforeExit", cleanup)

		while (true) {
			const { primitive } = await inquirer.prompt<{
				primitive: PrimitiveWithExit
			}>([
				{
					name: "primitive",
					type: "list",
					message: "Pick a primitive",
					choices: [
						...primitives.map((p) => ({
							name: chalk.bold(`${p.type}(${p.value.name})`),
							value: p,
							description: p.value.description,
						})),
						{
							name: chalk.red("Exit"),
							value: { type: "exit" } as const,
						},
					],
				},
			])

			// Handle exit choice
			if (primitive.type === "exit") {
				await cleanup()
				return
			}

			let result: unknown
			let itemSpinner: ReturnType<typeof ora> | undefined

			if (primitive.type === "resource") {
				itemSpinner = ora(`Reading resource ${primitive.value.uri}...`).start()
				result = await client
					.readResource({ uri: primitive.value.uri })
					.catch((err) => {
						itemSpinner?.fail(err.message)
						return undefined
					})
			} else if (primitive.type === "tool") {
				console.log(chalk.cyan(`\nTool: ${primitive.value.name}`))
				console.log(
					chalk.dim(
						`Description: ${primitive.value.description || "No description"}`,
					),
				)
				console.log(chalk.cyan("\nInput Schema:"))
				console.dir(primitive.value.inputSchema, { depth: null, colors: true })
				console.log("\n")
				continue
			} else if (primitive.type === "prompt") {
				const args = await readPromptArgumentInputs(primitive.value.arguments)
				itemSpinner = ora(`Using prompt ${primitive.value.name}...`).start()
				result = await client
					.getPrompt({ name: primitive.value.name, arguments: args })
					.catch((err) => {
						itemSpinner?.fail(err.message)
						return undefined
					})
			}

			if (itemSpinner) {
				itemSpinner.succeed()
			}

			if (result) {
				console.dir(result, { depth: null, colors: true })
				console.log("\n")
			}
		}
	} catch (error) {
		spinner.fail(
			`Failed to connect to server: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)

		// Clean up the client if it exists
		if (client) {
			await client.close()
		}

		process.exit(1)
	}
}

async function readPromptArgumentInputs(
	args: Prompt["arguments"],
): Promise<Record<string, string>> {
	if (!args || args.length === 0) {
		return {}
	}

	return inquirer.prompt(
		args.map((arg) => ({
			type: "text",
			name: arg.name,
			message: chalk.dim(
				`${arg.required ? "* " : ""}${arg.name}: ${arg.description || ""}`,
			),
		})),
	) as Promise<Record<string, string>>
}

/* Main function to inspect a server */
export async function inspectServer(
	qualifiedName: string,
	apiKey?: string,
): Promise<void> {
	const spinner = ora(`Resolving ${qualifiedName}...`).start()
	let transport: StdioClientTransport | null = null

	try {
		// Fetch server details from registry
		const { connection } = await resolveServer(
			parseQualifiedName(qualifiedName),
		)
		verbose(`Resolved server package: ${qualifiedName}`)
		spinner.succeed(`Successfully resolved ${qualifiedName}`)
		verbose(`Selected connection type: ${connection.type}`)

		// Collect configuration values if needed
		const configValues = await collectConfigValues(connection)
		verbose(
			`Collected configuration keys: ${Object.keys(configValues).join(", ")}`,
		)

		// Pass API key via environment variable instead of --key flag
		// (the run command no longer accepts --key option)
		const runtimeEnv = getRuntimeEnvironment(
			apiKey ? { SMITHERY_BEARER_AUTH: apiKey } : {},
		)
		verbose(`Runtime environment: ${Object.keys(runtimeEnv).length} variables`)

		// Create appropriate transport with environment variables
		transport = new StdioClientTransport({
			command: "npx",
			args: [
				"-y",
				"@smithery/cli@latest",
				"run",
				qualifiedName,
				"--config",
				JSON.stringify(JSON.stringify(configValues)),
			],
			env: runtimeEnv,
		})
		verbose(`Created transport for server: ${qualifiedName}`)

		// Connect to the server and start interactive session
		await connectServer(transport)
	} catch (error) {
		spinner.fail(`Failed to inspect ${qualifiedName}`)
		if (error instanceof APIConnectionTimeoutError) {
			console.error(
				chalk.red(
					"Error: Request timed out. Please check your connection and try again.",
				),
			)
		} else if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`))
		} else {
			console.error(chalk.red("An unexpected error occurred during inspection"))
		}

		// Close transport if it exists
		if (transport) {
			await transport.close()
		}

		process.exit(1)
	}
}
