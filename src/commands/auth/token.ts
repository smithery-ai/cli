import { z } from "zod"
import { fatal } from "../../lib/cli-error"
import { createSmitheryClient } from "../../lib/smithery-client"
import { isJsonMode, outputDetail } from "../../utils/output"

// Keep in sync with Constraint in @smithery/api/resources/tokens
const ConstraintSchema = z.object({
	resources: z
		.union([
			z.enum(["connections", "servers", "namespaces", "skills"]),
			z.array(z.enum(["connections", "servers", "namespaces", "skills"])),
		])
		.optional(),
	operations: z
		.union([
			z.enum(["read", "write", "execute"]),
			z.array(z.enum(["read", "write", "execute"])),
		])
		.optional(),
	namespaces: z.union([z.string(), z.array(z.string())]).optional(),
	ttl: z.union([z.string(), z.number()]).optional(),
	metadata: z
		.union([
			z.record(z.string(), z.string()),
			z.array(z.record(z.string(), z.string())),
		])
		.optional(),
	rpcReqMatch: z.record(z.string(), z.string()).optional(),
})

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
