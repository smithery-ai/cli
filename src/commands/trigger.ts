import pc from "picocolors"
import { fatal } from "../lib/cli-error"
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
		pc.yellow(
			"Triggers are in preview. Breaking changes may happen without notice.",
		),
	)
}

export async function listTriggers(
	connection: string,
	options: { namespace?: string },
): Promise<void> {
	warnPreview()
	try {
		const session = await ConnectSession.create(options.namespace)
		const triggers = await session.listTriggers(connection)
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
	options: { namespace?: string },
): Promise<void> {
	warnPreview()
	try {
		const session = await ConnectSession.create(options.namespace)
		const trigger = await session.getTrigger(connection, name)
		outputDetail({
			data: {
				connection,
				name: trigger.name,
				description: trigger.description,
				delivery: trigger.delivery,
				inputSchema: trigger.inputSchema,
				payloadSchema: trigger.payloadSchema,
			},
			tip: `Use smithery trigger subscribe ${connection} ${name} --url <url> --secret <whsec_...> [params] to subscribe.`,
		})
	} catch (error) {
		fatal("Failed to get trigger", error)
	}
}

export async function subscribeTrigger(
	connection: string,
	name: string,
	paramsJson: string | undefined,
	options: { namespace?: string; url?: string; secret?: string },
): Promise<void> {
	warnPreview()
	try {
		if (!options.url) {
			fatal("--url <url> is required to subscribe to a trigger.")
		}
		if (!options.secret) {
			fatal(
				"--secret <whsec_...> is required. Provide a Standard Webhooks signing secret (whsec_<base64 of 24-64 random bytes>).",
			)
		}

		const params =
			parseJsonObject<Record<string, unknown>>(paramsJson, "Params") ?? {}
		const session = await ConnectSession.create(options.namespace)
		const subscription = await session.subscribeTrigger(
			connection,
			name,
			params,
			{ url: options.url, secret: options.secret },
		)

		outputDetail({
			data: {
				id: subscription.id,
				refreshBefore: subscription.refreshBefore,
				connection,
				name,
				params,
				url: options.url,
			},
			tip: `Subscription expires at ${subscription.refreshBefore}. Re-run subscribe with the same params and --url to refresh the TTL.`,
		})
	} catch (error) {
		fatal("Failed to subscribe to trigger", error)
	}
}

export async function unsubscribeTrigger(
	connection: string,
	name: string,
	paramsJson: string | undefined,
	options: { namespace?: string; url?: string },
): Promise<void> {
	warnPreview()
	try {
		if (!options.url) {
			fatal(
				"--url <url> is required. Subscriptions are keyed by (params, delivery url).",
			)
		}

		const params =
			parseJsonObject<Record<string, unknown>>(paramsJson, "Params") ?? {}
		const session = await ConnectSession.create(options.namespace)
		await session.unsubscribeTrigger(connection, name, params, options.url)

		if (isJsonMode()) {
			outputJson({
				removed: [{ connection, name, url: options.url, params }],
			})
			return
		}

		console.log(
			`${pc.green("✓")} Unsubscribed ${name} (url: ${options.url}) from ${connection}`,
		)
	} catch (error) {
		fatal("Failed to unsubscribe trigger", error)
	}
}
