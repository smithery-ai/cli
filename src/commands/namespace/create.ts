import pc from "picocolors"
import { fatal } from "../../lib/cli-error"
import { createSmitheryClient } from "../../lib/smithery-client"
import { setNamespace } from "../../utils/smithery-settings"

export async function createNamespace(name: string): Promise<void> {
	const client = await createSmitheryClient()

	try {
		await client.namespaces.set(name)
		console.log(pc.green(`Created and claimed namespace: ${name}`))

		const result = await setNamespace(name)
		if (result.success) {
			console.log(pc.green(`Switched to namespace: ${name}`))
		}
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.toLowerCase().includes("already exists")
		) {
			fatal(`Namespace "${name}" already exists.`)
		}
		fatal("Failed to create namespace", error)
	}
}
