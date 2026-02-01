import chalk from "chalk"
import { VALID_CLIENTS, type ValidClient } from "../config/clients"
import { searchServers } from "../lib/registry"

// Re-export parsing utilities from cli-utils for backward compatibility
export { parseServerConfig } from "./cli-utils.js"

/**
 * Prompts user to select a client if not provided
 * @param providedClient - Client provided via CLI option
 * @param actionDescription - Description of the action being performed (e.g., "Installing", "Uninstalling")
 * @returns Promise<ValidClient> - The selected client
 */
export async function selectClient(
	providedClient: string | undefined,
	actionDescription = "Working with",
): Promise<ValidClient> {
	if (providedClient) {
		return providedClient as ValidClient
	}

	console.log(chalk.cyan("*"), `${actionDescription} MCP server`)
	console.log()

	const inquirer = (await import("inquirer")).default
	const autocompletePrompt = (await import("inquirer-autocomplete-prompt"))
		.default
	inquirer.registerPrompt("autocomplete", autocompletePrompt)

	const { client } = await inquirer.prompt([
		{
			type: "autocomplete",
			name: "client",
			message: "Select client:",
			source: (_: unknown, input: string) => {
				const filtered = VALID_CLIENTS.filter((client) =>
					client.toLowerCase().includes((input || "").toLowerCase()),
				)
				return Promise.resolve(filtered)
			},
		},
	])

	return client as ValidClient
}

/**
 * Validates that the provided client is valid
 * @param client - Client to validate
 * @throws Process exit if client is invalid
 */
export function validateClient(client: string): asserts client is ValidClient {
	if (!VALID_CLIENTS.includes(client)) {
		console.error(
			chalk.yellow(
				`Invalid client "${client}". Valid options are: ${VALID_CLIENTS.join(", ")}`,
			),
		)
		process.exit(1)
	}
}

/**
 * Prompts user to choose how they want to specify a server
 * @returns Promise<"search" | "direct"> - The selected input method
 */
async function chooseServerInputMethod(): Promise<"search" | "direct"> {
	const inquirer = (await import("inquirer")).default
	const { inputMethod } = await inquirer.prompt([
		{
			type: "list",
			name: "inputMethod",
			message: "How would you like to specify the server?",
			choices: [
				{ name: "Search for servers", value: "search" },
				{ name: "Enter server id", value: "direct" },
			],
		},
	])
	return inputMethod
}

/**
 * Performs server search and allows user to select from results
 * @param apiKey - API key for search (optional, will prompt if needed)
 * @returns Promise<string> - The selected server's qualified name
 */
async function searchAndSelectServer(apiKey?: string): Promise<string> {
	const inquirer = (await import("inquirer")).default

	const { searchTerm } = await inquirer.prompt([
		{
			type: "input",
			name: "searchTerm",
			message: "Search for servers:",
			validate: (input: string) =>
				input.trim().length > 0 || "Please enter a search term",
		},
	])

	try {
		const ora = (await import("ora")).default
		const spinner = ora(`Searching for "${searchTerm}"...`).start()

		// API key is optional for search - don't prompt
		const servers = await searchServers(searchTerm, apiKey)

		if (servers.length === 0) {
			spinner.fail(`No servers found for "${searchTerm}"`)
			process.exit(0)
		}

		spinner.succeed(
			`Found ${servers.length} server${servers.length === 1 ? "" : "s"}`,
		)
		console.log()

		const autocompletePrompt = (await import("inquirer-autocomplete-prompt"))
			.default
		inquirer.registerPrompt("autocomplete", autocompletePrompt)

		const { serverChoice } = await inquirer.prompt([
			{
				type: "autocomplete",
				name: "serverChoice",
				message: "Select server to install:",
				source: (_: unknown, input: string) => {
					const filtered = servers
						.filter(
							(s) =>
								s.qualifiedName
									.toLowerCase()
									.includes((input || "").toLowerCase()) ||
								s.displayName
									?.toLowerCase()
									.includes((input || "").toLowerCase()) ||
								s.description
									?.toLowerCase()
									.includes((input || "").toLowerCase()),
						)
						.map((s) => {
							const displayName = s.displayName || s.qualifiedName
							const toolCalls = `${s.useCount.toLocaleString()} tool calls`
							// @TODO: Add verification checkmark when API supports verified field
							// const verifiedMark = s.verified ? " • ✓ verified" : ""
							const qualifiedName =
								s.qualifiedName !== displayName ? ` • ${s.qualifiedName}` : ""

							return {
								name: `${displayName} • ${toolCalls}${qualifiedName}`,
								value: s.qualifiedName,
							}
						})
					return Promise.resolve(filtered)
				},
			},
		])
		return serverChoice
	} catch (error) {
		const ora = (await import("ora")).default
		const spinner = ora().start()
		spinner.fail("Failed to search servers")
		console.error(
			chalk.red(error instanceof Error ? error.message : String(error)),
		)
		process.exit(1)
	}
}

/**
 * Prompts user to enter a server ID directly
 * @returns Promise<string> - The entered server ID (trimmed)
 */
async function promptForServerId(): Promise<string> {
	const inquirer = (await import("inquirer")).default

	const { serverId } = await inquirer.prompt([
		{
			type: "input",
			name: "serverId",
			message: "Enter server ID:",
			validate: (input: string) => {
				const trimmed = input.trim()
				if (trimmed.length === 0) {
					return "Please enter a server ID"
				}
				// Basic validation for server ID format (can be enhanced)
				if (!/^[a-zA-Z0-9._/@-]+$/.test(trimmed)) {
					return "Server ID should only contain letters, numbers, dots, underscores, hyphens, forward slashes, and @"
				}
				return true
			},
		},
	])
	return serverId.trim()
}

/**
 * Complete server selection flow - handles both search and direct input methods
 * @param providedServer - Server provided via CLI argument
 * @param clientName - Name of the client for display purposes
 * @param apiKey - API key for search (optional, will prompt if needed)
 * @returns Promise<string> - The selected server's qualified name
 */
export async function selectServer(
	providedServer: string | undefined,
	clientName: string,
	apiKey?: string,
): Promise<string> {
	if (providedServer) {
		return providedServer
	}

	console.log(
		chalk.cyan("*"),
		"Installing MCP server for",
		chalk.cyan(clientName),
	)
	console.log()

	const inputMethod = await chooseServerInputMethod()

	if (inputMethod === "search") {
		return await searchAndSelectServer(apiKey)
	} else {
		const serverId = await promptForServerId()
		console.log()
		return serverId
	}
}

/**
 * Selects a server from the list of installed servers for uninstallation
 * @param providedServer - Server provided via CLI argument
 * @param clientName - Name of the client
 * @param installedServers - Array of installed server names
 * @returns Promise<string> - The selected server name
 */
export async function selectInstalledServer(
	providedServer: string | undefined,
	clientName: string,
	installedServers: string[],
): Promise<string> {
	if (providedServer) {
		return providedServer
	}

	console.log(
		chalk.cyan("*"),
		"Uninstalling server from",
		chalk.cyan(clientName),
	)
	console.log()

	if (installedServers.length === 0) {
		console.log(chalk.yellow(`No servers installed for ${clientName}`))
		process.exit(0)
	}

	const inquirer = (await import("inquirer")).default
	const autocompletePrompt = (await import("inquirer-autocomplete-prompt"))
		.default
	inquirer.registerPrompt("autocomplete", autocompletePrompt)

	const { serverName } = await inquirer.prompt([
		{
			type: "autocomplete",
			name: "serverName",
			message: `Select server to uninstall from ${clientName}:`,
			source: (_: unknown, input: string) => {
				const filtered = installedServers.filter((server) =>
					server.toLowerCase().includes((input || "").toLowerCase()),
				)
				return Promise.resolve(filtered)
			},
		},
	])
	return serverName
}

/**
 * Prompts user to choose whether to use existing configuration or create new
 * @returns Promise<boolean> - true to use existing config, false to create new
 */
export async function promptForExistingConfig(): Promise<boolean> {
	const inquirer = (await import("inquirer")).default
	const { useExisting } = await inquirer.prompt([
		{
			type: "list",
			name: "useExisting",
			message: "Configuration already exists for this server.",
			choices: [
				{ name: "Use existing configuration", value: true },
				{
					name: "Create new configuration (will overwrite)",
					value: false,
				},
			],
		},
	])
	return useExisting
}

/**
 * Prompts for a search term if not provided
 * @param providedTerm - Search term provided via CLI argument
 * @returns Promise<string> - The search term
 */
async function getSearchTerm(providedTerm?: string): Promise<string> {
	if (providedTerm) {
		return providedTerm
	}

	const inquirer = (await import("inquirer")).default
	const result = await inquirer.prompt([
		{
			type: "input",
			name: "searchTerm",
			message: "Search for servers:",
			validate: (input: string) =>
				input.trim().length > 0 || "Please enter a search term",
		},
	])
	console.log()
	return result.searchTerm
}

/**
 * Interactive server search and browsing with detailed view
 * @param apiKey - API key for search
 * @param initialTerm - Initial search term (optional)
 * @returns Promise<void>
 */
export async function interactiveServerSearch(
	apiKey?: string,
	initialTerm?: string,
): Promise<void> {
	let searchTerm = await getSearchTerm(initialTerm)

	try {
		while (true) {
			const ora = (await import("ora")).default
			const spinner = ora(`Searching for "${searchTerm}"...`).start()

			const servers = await searchServers(searchTerm, apiKey)

			if (servers.length === 0) {
				spinner.fail(`No servers found for "${searchTerm}"`)
				return
			}

			spinner.succeed(
				`☀ ${servers.length < 10 ? `Found ${servers.length} result${servers.length === 1 ? "" : "s"}:` : `Showing top (${servers.length}) results:`}`,
			)
			console.log(
				chalk.dim(
					`${chalk.cyan("→ View more")} at smithery.ai/search?q=${searchTerm.replace(/\s+/g, "+")}`,
				),
			)
			console.log()

			// Show interactive selection
			const inquirer = (await import("inquirer")).default
			const autocompletePrompt = (await import("inquirer-autocomplete-prompt"))
				.default
			inquirer.registerPrompt("autocomplete", autocompletePrompt)

			const { selectedServer } = await inquirer.prompt([
				{
					type: "autocomplete",
					name: "selectedServer",
					message: "Select server for details (or search again):",
					source: (_: unknown, input: string) => {
						const options = [
							{ name: chalk.dim("← Search again"), value: "__SEARCH_AGAIN__" },
							{ name: chalk.dim("Exit"), value: "__EXIT__" },
						]

						const filtered = servers
							.filter(
								(s) =>
									s.qualifiedName
										.toLowerCase()
										.includes((input || "").toLowerCase()) ||
									s.displayName
										?.toLowerCase()
										.includes((input || "").toLowerCase()),
							)
							.map((s) => {
								const displayName = s.displayName || s.qualifiedName
								const usageInfo =
									s.useCount > 0
										? chalk.dim(` (${s.useCount.toLocaleString()} calls/month)`)
										: ""
								return {
									name: `${displayName}${usageInfo}`,
									value: s.qualifiedName,
								}
							})

						return Promise.resolve([...options, ...filtered])
					},
				},
			])

			if (selectedServer === "__EXIT__") {
				return
			} else if (selectedServer === "__SEARCH_AGAIN__") {
				searchTerm = await getSearchTerm()
				continue
			}

			// Show detailed view of selected server
			console.log()
			const selectedServerData = servers.find(
				(s) => s.qualifiedName === selectedServer,
			)
			if (selectedServerData) {
				const displayName =
					selectedServerData.displayName || selectedServerData.qualifiedName
				console.log(`${chalk.bold.cyan(displayName)}`)
				console.log(
					`${chalk.dim("Qualified name:")} ${selectedServerData.qualifiedName}`,
				)
				if (selectedServerData.description) {
					console.log(
						`${chalk.dim("Description:")} ${selectedServerData.description}`,
					)
				}
				console.log(
					`${chalk.dim("Usage:")} ${selectedServerData.useCount.toLocaleString()} calls/month`,
				)
				console.log()
				console.log(
					chalk.dim(
						`Use 'smithery install ${selectedServerData.qualifiedName}' to install`,
					),
				)

				// Ask what to do next
				const { action } = await inquirer.prompt([
					{
						type: "list",
						name: "action",
						message: "What would you like to do?",
						choices: [
							{ name: "← Back to server list", value: "back" },
							{ name: "← Search again", value: "search" },
							{ name: "Exit", value: "exit" },
						],
					},
				])

				if (action === "back") {
					console.log()
				} else if (action === "search") {
					searchTerm = await getSearchTerm()
				} else {
					return // Exit
				}
			}
		}
	} catch (error) {
		console.error(
			chalk.red("Error searching servers:"),
			error instanceof Error ? error.message : String(error),
		)
		process.exit(1)
	}
}

/**
 * Prompts user to select a namespace from a list
 * @param namespaces - Array of namespace names
 * @returns Promise<string> - The selected namespace name
 */
export async function promptForNamespaceSelection(
	namespaces: string[],
): Promise<string> {
	const inquirer = (await import("inquirer")).default

	const { namespace } = await inquirer.prompt([
		{
			type: "list",
			name: "namespace",
			message: "Select namespace:",
			choices: namespaces.map((ns) => ({ name: ns, value: ns })),
		},
	])

	return namespace
}

/**
 * Prompts user to enter a new namespace name
 * @returns Promise<string> - The entered namespace name
 */
export async function promptForNamespaceCreation(): Promise<string> {
	const inquirer = (await import("inquirer")).default

	const { namespace } = await inquirer.prompt([
		{
			type: "input",
			name: "namespace",
			message: "Enter namespace name:",
			validate: (input: string) => {
				const trimmed = input.trim()
				if (trimmed.length === 0) {
					return "Please enter a namespace name"
				}
				if (trimmed.length > 100) {
					return "Namespace name must be 100 characters or less"
				}
				if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
					return "Namespace name must contain only letters, numbers, hyphens, and underscores"
				}
				return true
			},
		},
	])

	return namespace.trim()
}

/**
 * Prompts user to enter a server name
 * @param namespace - Optional namespace to display in the prompt
 * @param defaultValue - Optional default value to pre-fill the prompt
 * @returns Promise<string> - The entered server name
 */
export async function promptForServerNameInput(
	namespace?: string,
	defaultValue?: string,
): Promise<string> {
	const inquirer = (await import("inquirer")).default

	const chalk = (await import("chalk")).default
	const message = namespace
		? `Enter server name ${chalk.dim(`(will be deployed as `)}${chalk.cyan.dim(`${namespace}/<name>`)}${chalk.dim(`)`)}:`
		: "Enter server name:"

	const { serverName } = await inquirer.prompt([
		{
			type: "input",
			name: "serverName",
			message,
			default: defaultValue,
			validate: (input: string) => {
				const trimmed = input.trim()
				if (trimmed.length === 0) {
					return "Please enter a server name"
				}
				if (!/^[\w-]+$/.test(trimmed)) {
					return "Server name must contain only letters, numbers, hyphens, and underscores"
				}
				return true
			},
		},
	])

	return serverName.trim()
}
