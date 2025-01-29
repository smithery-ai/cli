import type { ResolvedServer } from "../types/registry.js"
import { StdioRunner } from "./stdio-runner.js"
import { createWSRunner as startWSRunner } from "./ws-runner.js"

/**
 * Picks the correct runner and starts the server.
 */
export async function pickServerAndRun(
	serverDetails: ResolvedServer,
	config: Record<string, unknown>,
	userId?: string,
): Promise<void> {
	// TODO: Change to WS
	const hasWS = serverDetails.connections.some((conn) => conn.type === "ws")
	const hasStdio = serverDetails.connections.some(
		(conn) => conn.type === "stdio",
	)

	if (hasWS) {
		const wsConnection = serverDetails.connections.find(
			(conn) => conn.type === "ws",
		)
		if (!wsConnection?.deploymentUrl) {
			throw new Error("Missing deployment URL")
		}
		await startWSRunner(wsConnection.deploymentUrl, config)
	} else if (hasStdio) {
		const runner = new StdioRunner()
		await runner.connect(serverDetails, config, userId)
	} else {
		throw new Error("No connection types found. Server not deployed.")
	}
}
