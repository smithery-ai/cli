import chalk from "chalk"
import { createConnection, getCurrentNamespace } from "./api"
import { outputJson } from "./output"

export async function addServer(
	mcpUrl: string,
	options: { name?: string; namespace?: string },
): Promise<void> {
	const namespace = options.namespace ?? (await getCurrentNamespace())

	try {
		const connection = await createConnection(namespace, mcpUrl, {
			name: options.name,
		})

		outputJson({
			connectionId: connection.connectionId,
			name: connection.name,
			status: connection.status?.state ?? "unknown",
		})
	} catch (error) {
		console.error(
			chalk.red(
				`Failed to add server: ${error instanceof Error ? error.message : String(error)}`,
			),
		)
		process.exit(1)
	}
}
