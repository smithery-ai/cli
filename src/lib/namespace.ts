import type { Smithery } from "@smithery/api"
import pc from "picocolors"
import yoctoSpinner from "yocto-spinner"
import {
	promptForNamespaceCreation,
	promptForNamespaceSelection,
} from "../utils/command-prompts.js"
import { createError } from "./errors.js"

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
		await client.namespaces.set(name)
	} catch (error) {
		throw createError(error, "Failed to create namespace")
	}
}

/**
 * Resolve namespace through interactive flow.
 * Handles three scenarios:
 * - Single namespace: Auto-selects it
 * - Multiple namespaces: Prompts user to select
 * - No namespaces: Prompts user to create/claim a namespace
 */
export async function resolveNamespace(client: Smithery): Promise<string> {
	// Get user's namespaces
	const spinner = yoctoSpinner({
		text: "Fetching namespaces...",
		color: "yellow",
	}).start()
	const userNamespaces = await getUserNamespaces(client)
	spinner.success(
		pc.dim(
			`Found ${userNamespaces.length} namespace${userNamespaces.length === 1 ? "" : "s"}`,
		),
	)

	if (userNamespaces.length === 0) {
		// No namespaces - prompt to create one (make it clear they will claim it)
		console.log(
			pc.yellow(
				"No namespaces found. You will create and claim a new namespace...",
			),
		)
		const newNamespaceName = await promptForNamespaceCreation()
		await createNamespace(client, newNamespaceName)
		console.log(
			pc.green(`✓ Created and claimed namespace: ${newNamespaceName}`),
		)
		return newNamespaceName
	} else if (userNamespaces.length === 1) {
		// Single namespace - use it automatically
		const namespace = userNamespaces[0]
		console.log(pc.dim(`Using namespace: ${pc.cyan(namespace)}`))
		return namespace
	} else {
		// Multiple namespaces - prompt to select
		return await promptForNamespaceSelection(userNamespaces)
	}
}
