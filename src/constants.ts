export const VALID_CLIENTS = [
	"claude",
	"cline",
	"windsurf",
	"roo-code",
	"witsy",
	"enconvo",
	"cursor",
	"vscode",
	"vscode-insiders",
] as const
export type ValidClient = (typeof VALID_CLIENTS)[number]

export const REGISTRY_ENDPOINT = process.env.REGISTRY_ENDPOINT
export const ANALYTICS_ENDPOINT = process.env.ANALYTICS_ENDPOINT
