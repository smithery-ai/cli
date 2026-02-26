import type { Constraint } from "@smithery/api/resources/tokens"
import { z } from "zod"
import { fatal } from "../../lib/cli-error"
import { createSmitheryClient } from "../../lib/smithery-client"
import { isJsonMode, outputDetail } from "../../utils/output"

export const ConstraintSchema = z
	.object({
		resources: z
			.union([
				z.enum(["connections", "servers", "namespaces", "skills"]),
				z.array(z.enum(["connections", "servers", "namespaces", "skills"])),
			])
			.describe(
				"Resource type(s) the token may access: connections, servers, namespaces, or skills.",
			)
			.optional(),
		operations: z
			.union([
				z.enum(["read", "write", "execute"]),
				z.array(z.enum(["read", "write", "execute"])),
			])
			.describe("Operation(s) the token may perform: read, write, or execute.")
			.optional(),
		namespaces: z
			.union([z.string(), z.array(z.string())])
			.describe(
				"Namespace(s) the token is scoped to. Accepts a single slug or an array.",
			)
			.optional(),
		ttl: z
			.union([z.string(), z.number()])
			.describe(
				'Time-to-live for the constraint. Accepts seconds (number) or a duration string such as "1h", "30m", or "20s". Max 24 hours, default 1 hour.',
			)
			.optional(),
		metadata: z
			.union([
				z.record(z.string(), z.string()),
				z.array(z.record(z.string(), z.string())),
			])
			.describe(
				'Key-value metadata for fine-grained filtering. A single object requires all pairs to match (AND). An array of objects requires any one to match (OR-of-AND), e.g. [{"userId":"alice"},{"team":"backend"}] grants access when either condition is met.',
			)
			.optional(),
		rpcReqMatch: z
			.record(z.string(), z.string())
			.describe(
				'MCP JSON-RPC request matching rules. Keys are dot-paths into the request body (e.g. "params.name", "method"). Values are regex patterns. All entries must match (AND).',
			)
			.optional(),
	})
	.strict() satisfies z.ZodType<Constraint>

export const constraintJsonSchema = z.toJSONSchema(ConstraintSchema)

export async function createToken(options: {
	policy: Array<Record<string, unknown>>
}) {
	const isJson = isJsonMode()
	const policy = options.policy.length > 0 ? options.policy : undefined

	try {
		const client = await createSmitheryClient()
		const result = await client.tokens.create(policy ? { policy } : undefined)

		outputDetail({
			data: {
				token: result.token,
				expiresAt: result.expiresAt,
			},
			json: isJson,
			tip: "Set SMITHERY_API_KEY=<token> to use this token.",
		})
	} catch (error) {
		fatal("Failed to create token", error)
	}
}
