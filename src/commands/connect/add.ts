import { setServer } from "./set"
import { addServer as addServerImpl } from "./add-impl"

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

	if (options.id) {
		// Use set for explicit ID
		return setServer(options.id, mcpUrl, { ...options, name })
	}
	// Use create for auto-generated ID
	return addServerImpl(mcpUrl, { ...options, name })
}
