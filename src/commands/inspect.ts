/* remove punycode depreciation warning */
process.removeAllListeners("warning")
process.on("warning", (warning) => {
	if (
		warning.name === "DeprecationWarning" &&
		warning.message.includes("punycode")
	) {
		return
	}
	console.warn(warning)
})

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { LoggingMessageNotificationSchema } from "@modelcontextprotocol/sdk/types.js"
import { isEmpty } from "lodash"
import inquirer from "inquirer"
import chalk from "chalk"
import ora from "ora"
import { resolvePackage } from "../registry"
import { chooseConnection, collectConfigValues } from "../utils/config"
import { getRuntimeEnvironment } from "../utils/runtime.js"

async function createClient() {
	const client = new Client(
		{ name: "smithery-cli", version: "1.0.0" },
		{ capabilities: {} },
	)
	client.setNotificationHandler(
		LoggingMessageNotificationSchema,
		(notification) => {
			console.debug("[server log]:", notification.params.data)
		},
	)
	return client
}

async function listPrimitives(client: Client) {
	const capabilities = client.getServerCapabilities() || {}
	const primitives: any[] = []
	const promises = []

	if (capabilities.resources) {
		promises.push(
			client.listResources().then(({ resources }) => {
				resources.forEach((item) =>
					primitives.push({ type: "resource", value: item }),
				)
			}),
		)
	}

	if (capabilities.tools) {
		promises.push(
			client.listTools().then(({ tools }) => {
				tools.forEach((item) => primitives.push({ type: "tool", value: item }))
			}),
		)
	}

	if (capabilities.prompts) {
		promises.push(
			client.listPrompts().then(({ prompts }) => {
				prompts.forEach((item) =>
					primitives.push({ type: "prompt", value: item }),
				)
			}),
		)
	}

	await Promise.all(promises)
	return primitives
}

async function connectServer(transport: any) {
	const spinner = ora("Connecting to server...").start()
	let client: Client | null = null

	try {
		client = await createClient()
		await client.connect(transport)
		const primitives = await listPrimitives(client)

		spinner.succeed(
			`Connected, server capabilities: ${Object.keys(client.getServerCapabilities() || {}).join(", ")}`,
		)

		// Setup exit handlers
		const cleanup = async () => {
			console.error("Closing connection...")
			if (client) {
				await client.close()
				client = null
			}
			process.exit(0)
		}

		// Handle exit signals
		process.on("SIGINT", cleanup)
		process.on("SIGTERM", cleanup)
		process.on("beforeExit", cleanup)

		while (true) {
			const { primitive } = await inquirer.prompt([
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
							value: { type: "exit" },
						},
					],
				},
			])

			// Handle exit choice
			if (primitive.type === "exit") {
				await cleanup()
				return
			}

			let result: any
			let itemSpinner: ReturnType<typeof ora> | undefined

			if (primitive.type === "resource") {
				itemSpinner = ora(`Reading resource ${primitive.value.uri}...`).start()
				result = await client
					.readResource({ uri: primitive.value.uri })
					.catch((err) => {
						itemSpinner?.fail(err.message)
						itemSpinner = undefined
					})
			} else if (primitive.type === "tool") {
				// Instead of executing the tool, just display its input schema
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
						itemSpinner = undefined
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
			`Failed to connect to server: ${error instanceof Error ? error.message : String(error)}`,
		)

		// Clean up the client if it exists
		if (client) {
			await client.close()
		}

		process.exit(1)
	}
}

async function readJSONSchemaInputs(schema: any) {
	if (!schema || isEmpty(schema)) {
		return {}
	}

	const questions: Array<{
		key: string
		required?: boolean
		type: string
		[key: string]: any
	}> = []
	// Traverse schema to build questions
	// This would be implemented similar to your existing code

	const results: Record<string, any> = {}
	for (const q of questions) {
		const { key, required, ...options } = q
		const { value } = await inquirer.prompt([
			{
				name: "value",
				message: chalk.dim(`${required ? "* " : ""}${key}`),
				...options,
			},
		])
		if (value !== "") {
			// Set path in results object
			results[key] = value
		}
	}
	return results
}

async function readPromptArgumentInputs(args: any[]) {
	if (!args || args.length === 0) {
		return {}
	}

	return inquirer.prompt(
		args.map((arg) => ({
			type: "text",
			name: arg.name,
			message: chalk.dim(
				`${arg.required ? "* " : ""}${arg.name}: ${arg.description}`,
			),
		})),
	)
}

/* Main function to inspect a server */
export async function inspectServer(qualifiedName: string): Promise<void> {
	const spinner = ora(`Resolving ${qualifiedName}...`).start()
	let transport: StdioClientTransport | null = null

	try {
		// Fetch server details from registry
		const server = await resolvePackage(qualifiedName)
		spinner.succeed(`Successfully resolved ${qualifiedName}`)

		// Choose a connection from available options
		const connection = chooseConnection(server)

		// Collect configuration values if needed
		const { configValues } = await collectConfigValues(connection)

		// Get runtime environment
		const runtimeEnv = getRuntimeEnvironment({})

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

		// Connect to the server and start interactive session
		await connectServer(transport)
	} catch (error) {
		spinner.fail(`Failed to inspect ${qualifiedName}`)
		if (error instanceof Error) {
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
