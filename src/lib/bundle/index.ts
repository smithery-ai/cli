import type { DeployPayload } from "@smithery/api/resources/servers/deployments"
import { buildShttpBundle } from "./shttp.js"
import { buildStdioBundle } from "./stdio.js"

export interface BundleOptions {
	entryFile?: string
	outDir?: string
	transport?: "shttp" | "stdio"
	production?: boolean
}

export interface BuildBundleResult {
	outDir: string
	payload: DeployPayload
	moduleFile: string
	sourcemapFile?: string
	mcpbFile?: string
}

/**
 * Build a complete Smithery bundle for deployment.
 * Handles both shttp (remote) and stdio (local) transports.
 */
export async function buildBundle(
	options: BundleOptions = {},
): Promise<BuildBundleResult> {
	const transport = options.transport || "shttp"

	if (transport === "stdio") {
		return buildStdioBundle({
			entryFile: options.entryFile,
			outDir: options.outDir,
			production: options.production,
		})
	}

	return buildShttpBundle({
		entryFile: options.entryFile,
		outDir: options.outDir,
		production: options.production,
	})
}
