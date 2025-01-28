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
	const hasSSE = serverDetails.connections.some((conn) => conn.type === "sse")
	const hasStdio = serverDetails.connections.some(
		(conn) => conn.type === "stdio",
	)

	if (hasSSE) {
		const sseConnection = serverDetails.connections.find(
			(conn) => conn.type === "sse",
		)
		if (!sseConnection?.deploymentUrl) {
			throw new Error("Missing deployment URL")
		}
		await startWSRunner(sseConnection.deploymentUrl, config)
	} else if (hasStdio) {
		const runner = new StdioRunner()
		await runner.connect(serverDetails, config, userId)
	} else {
		throw new Error("No connection types found. Server not deployed.")
	}
}
