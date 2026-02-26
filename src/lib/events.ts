import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { z } from "zod"

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
