export const VALID_CLIENTS = ["claude", "cline", "roo-cline"] as const
export type ValidClient = (typeof VALID_CLIENTS)[number]

export const REGISTRY_ENDPOINT =
	process.env.REGISTRY_ENDPOINT || "https://registry.smithery.ai"
