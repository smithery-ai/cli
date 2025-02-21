import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import inquirer from "inquirer"
import chalk from "chalk"
import type { StdioConnection } from "../types/registry.js"

interface ServerPrimitive {
	type: "resource" | "tool" | "prompt"
	value: {
		name: string
		description?: string
		uri?: string
	}
}

export async function createServerConnection(
	id: string,
	config: StdioConnection,
): Promise<any> {
	// console.log('Creating server connection with config:', JSON.stringify(config, null, 2));

	if (!config) {
		throw new Error(`No connection configuration found for server ${id}`)
	}

	const transport = new StdioClientTransport({
		command: process.platform === "win32" ? "npx.cmd" : "/usr/local/bin/npx",
		args: config.args || [],
		env: {
			...(process.env as Record<string, string>),
			...((config.env || {}) as Record<string, string>),
		},
	})

	const client = new Client(
		{ name: "mcp-cli", version: "1.0.0" },
		{ capabilities: {} },
	)

	await client.connect(transport)
	return client
}

export async function listServerPrimitives(
	client: Client,
): Promise<ServerPrimitive[]> {
	const capabilities = client.getServerCapabilities() || {}
	const primitives: ServerPrimitive[] = []
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

export async function selectPrimitive(primitives: ServerPrimitive[]) {
	const truncateDescription = (desc: string, maxLength = 100) => {
		if (!desc) return "No description"
		return desc.length > maxLength ? `${desc.slice(0, maxLength)}...` : desc
	}

	const choices = [
		...primitives.map((p) => ({
			name: `${chalk.green(`${p.type}(${p.value.name})`)} - ${chalk.gray(truncateDescription(p.value.description || ""))}`,
			value: p,
			description: p.value.description,
		})),
		new inquirer.Separator(),
		{
			name: chalk.yellow("↩ Back"),
			value: "back",
		},
		{
			name: chalk.red("✖ Exit"),
			value: "exit",
		},
	]

	const { selected } = await inquirer.prompt([
		{
			type: "list",
			name: "selected",
			message: "Pick a primitive",
			choices,
			pageSize: 10,
		},
	])

	return selected
}

export async function inspectServer(client: Client) {
	const primitives = await listServerPrimitives(client)

	while (true) {
		const selected = await selectPrimitive(primitives)

		if (selected === "back") {
			return null
		}
		if (selected === "exit") {
			await client.close()
			return "exit"
		}

		// Pretty print the specification with colors
		const spec = {
			type: selected.type,
			value: {
				name: selected.value.name,
				description: selected.value.description,
				...(selected.type === "tool" && {
					inputSchema: (await client.listTools({ name: selected.value.name }))
						?.tools?.[0]?.inputSchema,
				}),
				...(selected.value.uri && { uri: selected.value.uri }),
			},
		}

		console.log(
			"\n",
			chalk.cyan(
				JSON.stringify(spec, null, 2)
					.replace(/"(\w+)":/g, (match) => chalk.green(match))
					.replace(/"([^"]+)"(?=,|\n|\})/g, (match) => chalk.yellow(match)),
			),
		)

		const { action } = await inquirer.prompt([
			{
				type: "list",
				name: "action",
				message: "What would you like to do?",
				choices: [
					{
						name: chalk.yellow("↩ Back to primitives"),
						value: "back",
					},
					{
						name: chalk.red("✖ Exit"),
						value: "exit",
					},
				],
			},
		])

		if (action === "exit") {
			await client.close()
			return "exit"
		}
	}
}
