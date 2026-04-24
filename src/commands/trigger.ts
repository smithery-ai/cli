import pc from "picocolors"
import { errorMessage, fatal, handleMCPAuthError } from "../lib/cli-error"
import { EmptyEventResultSchema } from "../lib/events"
import {
	isJsonMode,
	outputDetail,
	outputJson,
	outputTable,
} from "../utils/output"
import { ConnectSession } from "./mcp/api"
import { parseJsonObject } from "./mcp/parse-json"

function warnPreview(): void {
	console.warn(
		pc.yellow("Triggers are in draft. Breaking change may happen without notice."),
	)
}

export async function listTriggers(
	connection: string,
	options: { namespace?: string },
): Promise<void> {
	warnPreview()
	try {
		const session = await ConnectSession.create(options.namespace)
		const triggers = await session.listEventTriggers(connection)
		const data = triggers.map((trigger) => ({
			name: trigger.name,
			delivery: (trigger.delivery ?? []).join(","),
			description: trigger.description ?? "",
			params: trigger.inputSchema ? "yes" : "no",
		}))

		outputTable({
			data,
			columns: [
				{ key: "name", header: "TRIGGER" },
				{ key: "delivery", header: "DELIVERY" },
				{ key: "params", header: "PARAMS" },
				{ key: "description", header: "DESCRIPTION" },
			],
			json: isJsonMode(),
			jsonData: { connection, triggers },
			tip:
				triggers.length === 0
					? `No triggers found for ${connection}.`
					: `Use smithery trigger get ${connection} <name> to inspect a trigger schema.`,
		})
	} catch (error) {
		fatal("Failed to list triggers", error)
	}
}

export async function getTrigger(
	connection: string,
	name: string,
	id: string | undefined,
	options: { namespace?: string },
): Promise<void> {
	warnPreview()
	try {
		const session = await ConnectSession.create(options.namespace)
		if (id) {
			const trigger = await session.getTriggerInstance(connection, name, id)
			outputDetail({
				data: {
					id: trigger.id,
					connection,
					name: trigger.name,
					params: trigger.params,
					createdAt: trigger.created_at,
				},
				tip: `Use smithery trigger unsubscribe ${connection} ${name} ${id} to delete this trigger.`,
			})
			return
		}

		const triggers = await session.listEventTriggers(connection)
		const trigger = triggers.find((event) => event.name === name)
		if (!trigger) {
			fatal(`Trigger "${name}" was not found on connection "${connection}".`)
		}
		outputDetail({
			data: {
				connection,
				name: trigger.name,
				description: trigger.description,
				delivery: trigger.delivery,
				inputSchema: trigger.inputSchema,
				payloadSchema: trigger.payloadSchema,
			},
			tip: `Use smithery trigger subscribe ${connection} ${name} [params] to create a trigger.`,
		})
	} catch (error) {
		fatal("Failed to get trigger", error)
	}
}

export async function subscribeTrigger(
	connection: string,
	name: string,
	paramsJson: string | undefined,
	options: { namespace?: string; url?: string; id?: string },
): Promise<void> {
	warnPreview()
	const isJson = isJsonMode()

	try {
		if (!options.url) {
			fatal("Trigger delivery URL is required. Pass --url <webhook-url>.")
		}

		const params =
			parseJsonObject<Record<string, unknown>>(paramsJson, "Params") ?? {}
		const session = await ConnectSession.create(options.namespace)
		const mcpClient = await session.getEventsClient(connection)
		try {
			const trigger = await mcpClient.request(
				{
					method: "ai.smithery/events/subscribe",
					params: {
						name,
						id: options.id ?? crypto.randomUUID(),
						params,
						delivery: {
							mode: "webhook",
							url: options.url,
						},
					},
				},
				EmptyEventResultSchema,
			)

			if (
				trigger &&
				typeof trigger === "object" &&
				Object.keys(trigger as Record<string, unknown>).length > 0
			) {
				outputDetail({
					data: {
						connection,
						name,
						url: options.url,
						...trigger,
					},
					tip: `Use smithery trigger unsubscribe ${connection} ${name} to delete this trigger.`,
				})
				return
			}

			if (isJson) {
				outputJson({
					connection,
					name,
					url: options.url,
					subscribed: true,
				})
			} else {
				console.log(
					pc.green(`Subscribed to ${pc.bold(name)} on ${connection}.`),
				)
			}
		} finally {
			await mcpClient.close()
		}
	} catch (error) {
		handleMCPAuthError(error, connection, { json: isJson })
		const msg = errorMessage(error)
		if (isJson) {
			outputJson({ error: `Failed to subscribe to trigger: ${msg}` })
		} else {
			console.error(pc.red(`Failed to subscribe to trigger: ${msg}`))
		}
		process.exit(1)
	}
}

export async function unsubscribeTrigger(
	connection: string,
	name: string,
	id: string | undefined,
	options: { namespace?: string },
): Promise<void> {
	warnPreview()
	const isJson = isJsonMode()

	try {
		const session = await ConnectSession.create(options.namespace)
		const mcpClient = await session.getEventsClient(connection)
		try {
			await mcpClient.request(
				{
					method: "ai.smithery/events/unsubscribe",
					params: { topic: name },
				},
				EmptyEventResultSchema,
			)
		} finally {
			await mcpClient.close()
		}

		if (isJson) {
			outputJson({
				removed: [{ connection, name, ...(id ? { id } : {}) }],
			})
			return
		}

		console.log(`${pc.green("✓")} Removed trigger ${name} from ${connection}`)
	} catch (error) {
		handleMCPAuthError(error, connection, { json: isJson })
		const msg = errorMessage(error)
		if (isJson) {
			outputJson({ error: `Failed to unsubscribe trigger: ${msg}` })
		} else {
			console.error(pc.red(`Failed to unsubscribe trigger: ${msg}`))
		}
		process.exit(1)
	}
}

export async function listSubscriptions(
	connection: string | undefined,
	options: { namespace?: string },
): Promise<void> {
	warnPreview()
	try {
		const session = await ConnectSession.create(options.namespace)
		const subscriptions = await session.listSubscriptions(connection)
		const data = subscriptions.map((subscription) => ({
			id: subscription.id,
			url: subscription.url,
		}))

		outputTable({
			data,
			columns: [
				{ key: "id", header: "ID" },
				{ key: "url", header: "URL" },
			],
			json: isJsonMode(),
			jsonData: {
				scope: connection ? "connection" : "namespace",
				...(connection ? { connection } : {}),
				subscriptions,
			},
			tip:
				subscriptions.length === 0
					? `No ${scopeLabel(connection)} subscriptions found.`
					: `Use smithery trigger subscription add <url>${connection ? ` ${connection}` : ""} to register another webhook.`,
		})
	} catch (error) {
		fatal("Failed to list subscriptions", error)
	}
}

export async function createSubscription(
	url: string,
	connection: string | undefined,
	options: { namespace?: string },
): Promise<void> {
	warnPreview()
	try {
		const session = await ConnectSession.create(options.namespace)
		const subscription = await session.createSubscription(url, connection)

		outputDetail({
			data: {
				id: subscription.id,
				url: subscription.url,
				scope: scopeLabel(connection),
				connection,
				secret: subscription.secret,
			},
			tip: "Store the secret securely. Smithery only returns it once.",
		})
	} catch (error) {
		fatal("Failed to create subscription", error)
	}
}

export async function removeSubscription(
	id: string,
	connection: string | undefined,
	options: { namespace?: string },
): Promise<void> {
	warnPreview()
	try {
		const session = await ConnectSession.create(options.namespace)
		await session.deleteSubscription(id, connection)

		if (isJsonMode()) {
			outputJson({
				removed: [{ id, ...(connection ? { connection } : {}) }],
			})
			return
		}

		console.log(
			`${pc.green("✓")} Removed ${scopeLabel(connection)} subscription ${id}`,
		)
	} catch (error) {
		fatal("Failed to remove subscription", error)
	}
}

function scopeLabel(connection: string | undefined): string {
	return connection ? "connection" : "namespace"
}
