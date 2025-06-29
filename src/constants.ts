export const VALID_CLIENTS = [
	"claude",
	"cline",
	"windsurf",
	"roocode",
	"witsy",
	"enconvo",
	"cursor",
	"vscode",
	"vscode-insiders",
	"boltai",
	"amazon-bedrock",
	"amazonq",
	"librechat",
] as const
export type ValidClient = (typeof VALID_CLIENTS)[number]

export const REGISTRY_ENDPOINT = process.env.REGISTRY_ENDPOINT
export const ANALYTICS_ENDPOINT = process.env.ANALYTICS_ENDPOINT
