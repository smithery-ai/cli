import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { z } from "zod"

export const TriggerSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	delivery: z.array(z.string()).optional(),
	inputSchema: z.record(z.string(), z.unknown()).optional(),
	payloadSchema: z.record(z.string(), z.unknown()).optional(),
})

export const ListTriggersResultSchema = z.object({
	events: z.array(TriggerSchema),
})

export const EventTopicSchema = z.object({
	topic: z.string(),
	name: z.string(),
	description: z.string().optional(),
	inputSchema: z.record(z.string(), z.unknown()).optional(),
	eventSchema: z.record(z.string(), z.unknown()).optional(),
})

export const ListEventTopicsResultSchema = z.object({
	topics: z.array(EventTopicSchema),
	nextCursor: z.string().optional(),
})

export const EmptyEventResultSchema = z.object({}).passthrough()

export type EventTopic = z.infer<typeof EventTopicSchema>
export type TriggerDescriptor = z.infer<typeof TriggerSchema>

export async function listEventTriggers(client: Client) {
	try {
		// biome-ignore lint/suspicious/noExplicitAny: custom JSON-RPC method not in SDK types
		return await (client.request as any)(
			{ method: "ai.smithery/events/list" },
			ListTriggersResultSchema,
		)
	} catch {
		const { eventTopics } = await listEventTopics(client)
		return {
			events: eventTopics.map((topic) => ({
				name: topic.topic,
				description: topic.description,
				inputSchema: topic.inputSchema,
				payloadSchema: topic.eventSchema,
			})),
		}
	}
}

/**
 * List all event topics from an MCP server supporting ai.smithery/events.
 * Paginates through all pages automatically.
 */
export async function listEventTopics(client: Client) {
	const eventTopics: EventTopic[] = []
	let cursor: string | undefined
	try {
		do {
			// biome-ignore lint/suspicious/noExplicitAny: custom JSON-RPC method not in SDK types
			const result = await (client.request as any)(
				{ method: "ai.smithery/events/topics/list", params: { cursor } },
				ListEventTopicsResultSchema,
			)
			eventTopics.push(...result.topics)
			cursor = result.nextCursor
		} while (cursor)
	} catch {
		// Server does not support events extension
		return { eventTopics: [] }
	}

	return { eventTopics }
}
