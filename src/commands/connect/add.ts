import { setServer } from "./set"

export async function addServer(
	mcpUrl: string,
	options: {
		id?: string
		name?: string
		namespace?: string
		metadata?: string
		headers?: string
	},
): Promise<void> {
	// If id is set but name is not, default name to id
	const name = options.name ?? options.id
	return setServer(mcpUrl, { ...options, name })
}
