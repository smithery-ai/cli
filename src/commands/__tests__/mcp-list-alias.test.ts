import { beforeAll, describe, expect, test } from "vitest"

let program: typeof import("../../index").program
const testGlobal = globalThis as typeof globalThis & {
	__SMITHERY_VERSION__: string
}

beforeAll(async () => {
	testGlobal.__SMITHERY_VERSION__ = "test"
	;({ program } = await import("../../index"))
})

describe("mcp list alias", () => {
	test("registers 'ls' with the same options as 'list'", () => {
		const mcpCmd = program.commands.find((command) => command.name() === "mcp")
		const listCmd = mcpCmd?.commands.find(
			(command) => command.name() === "list",
		)
		const lsCmd = mcpCmd?.commands.find((command) => command.name() === "ls")

		expect(listCmd).toBeDefined()
		expect(lsCmd).toBeDefined()
		expect(lsCmd?.options.map((option) => option.flags)).toEqual(
			listCmd?.options.map((option) => option.flags),
		)
	})
})
