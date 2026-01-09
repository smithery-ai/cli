export { createMcpbManifest } from "./mcpb-manifest.js"
export { type ScanResult, scanModule } from "./scan.js"
export {
	buildShttpBundle,
	type ShttpBundleOptions,
	type ShttpBundleResult,
} from "./shttp.js"
export {
	buildStdioBundle,
	type StdioBundleOptions,
	type StdioBundleResult,
} from "./stdio.js"

import { buildShttpBundle } from "./shttp.js"
import { buildStdioBundle } from "./stdio.js"

// Re-export DeployPayload type - should be available from SDK once regenerated
// For now, define it locally based on the OpenAPI schema
export type DeployPayload =
	| {
			type: "hosted"
			stateful?: boolean
			configSchema?: Record<string, unknown>
			serverCard?: unknown
			source?: { commit?: string; branch?: string }
	  }
	| { type: "external"; upstreamUrl: string }
	| {
			type: "stdio"
			runtime?: "node"
			configSchema?: Record<string, unknown>
			serverCard?: unknown
			source?: { commit?: string; branch?: string }
	  }

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
