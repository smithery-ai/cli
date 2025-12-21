/**
 * Extracts the server name from a server ID
 * @param serverId - The server ID to extract from
 * @returns The server name portion of the ID
 */
export function getServerName(serverId: string): string {
	const lastSlashIndex = serverId.lastIndexOf("/")
	if (lastSlashIndex !== -1) {
		return serverId.substring(lastSlashIndex + 1)
	}
	return serverId
}
