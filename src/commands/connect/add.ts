import chalk from "chalk"
import { ConnectSession } from "./api"
import { outputJson } from "./output"

export async function addServer(
	mcpUrl: string,
	options: { name?: string; namespace?: string },
): Promise<void> {
	try {
		const session = await ConnectSession.create(options.namespace)
		const connection = await session.createConnection(mcpUrl, {
			name: options.name,
		})

		const output: Record<string, unknown> = {
			connectionId: connection.connectionId,
			name: connection.name,
			status: connection.status?.state ?? "unknown",
		}

		// Include auth URL if authorization is required
		if (
			connection.status?.state === "auth_required" &&
			"authorizationUrl" in connection.status &&
			connection.status.authorizationUrl
		) {
			output.authorizationUrl = connection.status.authorizationUrl
		}

		outputJson(output)
	} catch (error) {
		console.error(
			chalk.red(
				`Failed to add server: ${error instanceof Error ? error.message : String(error)}`,
			),
		)
		process.exit(1)
	}
}
