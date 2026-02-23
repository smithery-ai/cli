import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
import { createSmitheryClient } from "../../lib/smithery-client"
import { isJsonMode, outputJson, outputTable } from "../../utils/output"

export async function listSecrets(server: string) {
	const client = await createSmitheryClient()

	try {
		const secrets = await client.servers.secrets.list(server)

		const data = secrets.map((s) => ({
			name: s.name,
			type: s.type,
		}))

		outputTable({
			data,
			columns: [
				{ key: "name", header: "NAME" },
				{ key: "type", header: "TYPE" },
			],
			json: isJsonMode(),
			jsonData: { secrets: data, server },
			tip:
				data.length === 0
					? `No secrets found. Use 'smithery mcp secrets set ${server}' to add one.`
					: `Use 'smithery mcp secrets set ${server}' to add or update a secret.`,
		})
	} catch (error) {
		fatal("Failed to list secrets", error)
	}
}

export async function setSecret(
	server: string,
	options: { name?: string; value?: string },
) {
	let { name, value } = options

	if (!name || !value) {
		if (!process.stdin.isTTY) {
			fatal(
				"Missing --name and/or --value flags (required in non-interactive mode)",
			)
		}

		const inquirer = (await import("inquirer")).default

		if (!name) {
			const answer = await inquirer.prompt([
				{
					type: "input",
					name: "name",
					message: "Secret name:",
					validate: (input: string) =>
						input.trim() ? true : "Secret name is required",
				},
			])
			name = answer.name
		}

		if (!value) {
			const answer = await inquirer.prompt([
				{
					type: "password",
					name: "value",
					message: `Value for ${name}:`,
					mask: "*",
					validate: (input: string) =>
						input.trim() ? true : "Secret value is required",
				},
			])
			value = answer.value
		}
	}

	const client = await createSmitheryClient()

	try {
		const result = await client.servers.secrets.set(server, {
			name: name!,
			value: value!,
		})

		if (isJsonMode()) {
			outputJson({ success: result.success, server, name })
		} else {
			console.log(`${pc.green("✓")} Secret "${name}" set for ${server}`)
		}
	} catch (error) {
		fatal("Failed to set secret", error)
	}
}

export async function deleteSecret(server: string, name: string) {
	const client = await createSmitheryClient()

	try {
		const result = await client.servers.secrets.delete(name, {
			qualifiedName: server,
		})

		if (isJsonMode()) {
			outputJson({ success: result.success, server, name })
		} else {
			console.log(`${pc.green("✓")} Secret "${name}" deleted from ${server}`)
		}
	} catch (error) {
		fatal("Failed to delete secret", error)
	}
}
