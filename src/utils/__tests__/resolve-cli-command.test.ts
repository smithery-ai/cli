import { afterEach, describe, expect, test, vi } from "vitest"
import { resolveNpmCliCommand } from "../resolve-cli-command"

describe("resolveNpmCliCommand", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	test("appends .cmd on Windows", () => {
		vi.spyOn(process, "platform", "get").mockReturnValue("win32")
		expect(resolveNpmCliCommand("claude")).toBe("claude.cmd")
	})

	test("keeps bare command names on non-Windows platforms", () => {
		vi.spyOn(process, "platform", "get").mockReturnValue("linux")
		expect(resolveNpmCliCommand("claude")).toBe("claude")
	})
})
