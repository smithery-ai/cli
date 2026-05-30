import { BadRequestError } from "@smithery/api"
import { describe, expect, test } from "vitest"
import { createError } from "../errors"

describe("createError", () => {
	test("formats invalid module diagnostics from API bad request errors", () => {
		const error = new BadRequestError(
			400,
			{
				error: {
					code: "invalid_module",
					message: "The submitted module could not be installed.",
					diagnostics: [
						{
							path: "support.ts",
							line: 3,
							column: 10,
							severity: "error",
							message:
								"Exported tool normalize must declare an explicit return type.",
						},
					],
				},
			},
			undefined,
			new Headers(),
		)

		const formatted = createError(
			error,
			"Failed to add source-backed connection",
		)

		expect(formatted.message).toContain(
			"Failed to add source-backed connection: The submitted module could not be installed.",
		)
		expect(formatted.message).toContain(
			"support.ts:3:10 Exported tool normalize must declare an explicit return type.",
		)
	})
})
