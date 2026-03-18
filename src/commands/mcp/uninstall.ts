import "../../utils/suppress-punycode-warning"
import pc from "picocolors"
import type { ValidClient } from "../../config/clients"
import { getClientConfiguration } from "../../config/clients.js"
import { fatal } from "../../lib/cli-error"
import { readConfig, writeConfig } from "../../lib/client-config-io"
import { deleteConfig } from "../../lib/keychain.js"
import { promptForRestart } from "../../utils/client"
import { isJsonMode } from "../../utils/output"

/* uninstalls server for given client */
export async function uninstallServer(
	qualifiedName: string,
	client: ValidClient,
): Promise<void> {
	const json = isJsonMode()
	try {
		/* check if client is command-type */
		const clientConfig = getClientConfiguration(client)
		if (clientConfig.install.method === "command") {
			if (json) {
				console.log(
					JSON.stringify({
						success: false,
						error: `Uninstallation is currently not supported for ${client}`,
					}),
				)
			} else {
				console.log(
					pc.yellow(`Uninstallation is currently not supported for ${client}`),
				)
			}
			return
		}

		/* read config from client */
		const config = readConfig(client)

		/* check if server exists in config */
		if (!config.mcpServers[qualifiedName]) {
			if (json) {
				console.log(
					JSON.stringify({
						success: false,
						error: `${qualifiedName} is not installed for ${client}`,
					}),
				)
			} else {
				console.log(pc.red(`${qualifiedName} is not installed for ${client}`))
			}
			return
		}

		/* remove server from config */
		delete config.mcpServers[qualifiedName]
		writeConfig(config, client)

		/* remove server config from keychain */
		await deleteConfig(qualifiedName)

		if (json) {
			console.log(
				JSON.stringify({
					success: true,
					qualifiedName,
					client,
					hint: `Restart ${client} to apply changes.`,
				}),
			)
		} else {
			console.log(
				pc.green(`✓ ${qualifiedName} successfully uninstalled from ${client}`),
			)
			await promptForRestart(client)
		}
	} catch (error) {
		fatal("Failed to uninstall server", error)
	}
}
