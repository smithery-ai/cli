import { setServer } from "./set"

export async function addServer(
	mcpUrl: string,
	options: {
		name?: string
		namespace?: string
		metadata?: string
	},
): Promise<void> {
	// Forward to set without an ID (auto-generates)
	return setServer(mcpUrl, options)
}
