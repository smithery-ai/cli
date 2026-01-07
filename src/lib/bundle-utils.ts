import type { DeployPayload, ServerCard } from "@smithery/sdk/bundle"

export function createDeployPayload(options: {
	stateful?: boolean
	commit?: string
	branch?: string
	serverCard?: ServerCard
	configSchema?: Record<string, unknown>
}): DeployPayload {
	return {
		type: "hosted",
		stateful: options.stateful ?? false,
		serverCard: options.serverCard,
		configSchema: options.configSchema,
		source: {
			commit: options.commit,
			branch: options.branch,
		},
	}
}
