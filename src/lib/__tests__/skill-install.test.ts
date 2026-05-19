/**
 * skill-install tests
 *
 * The user-facing `smithery skill` command was removed (SMI-1682); the
 * `installSkill` passthrough is retained for the `setup` command. These tests
 * lock its public-API resolve (no auth) and npx-skills flag mapping.
 */

import { beforeEach, describe, expect, test, vi } from "vitest"

function createSmitheryMock() {
	return {
		Smithery: vi.fn().mockImplementation((config) => ({
			_config: config,
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

// Mock both import paths to the same factory
vi.mock("@smithery/api", () => createSmitheryMock())
vi.mock("@smithery/api/client.js", () => createSmitheryMock())

// Mock child_process for install
vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}))

// Mock console methods
vi.spyOn(console, "log").mockImplementation(() => {})
vi.spyOn(console, "error").mockImplementation(() => {})

import { Smithery } from "@smithery/api"

async function getCommand(): Promise<string> {
	const { execSync } = await import("node:child_process")
	return (execSync as ReturnType<typeof vi.fn>).mock.calls[0][0]
}

describe("installSkill resolves via public API (no auth)", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("creates Smithery client with empty API key and delegates to npx skills", async () => {
		const { execSync } = await import("node:child_process")
		const { installSkill } = await import("../skill-install")

		await installSkill("test-ns/test-skill", "claude-code", {})

		expect(Smithery).toHaveBeenCalledWith({ apiKey: "" })
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("npx -y skills add"),
			expect.any(Object),
		)
	})
})

describe("installSkill flag mapping", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("no agent, no options — interactive, no flags", async () => {
		const { installSkill } = await import("../skill-install")
		await installSkill("test-ns/test-skill")

		const command = await getCommand()
		expect(command).toBe(
			"npx -y skills add https://smithery.ai/skills/test-ns/test-skill",
		)
	})

	test("with agent, no yes — adds --agent but stays interactive", async () => {
		const { installSkill } = await import("../skill-install")
		await installSkill("test-ns/test-skill", "claude-code", {})

		const command = await getCommand()
		expect(command).toContain("--agent claude-code")
		expect(command).not.toMatch(/-y$/)
	})

	test("with agent and yes — adds --agent and -y", async () => {
		const { installSkill } = await import("../skill-install")
		await installSkill("test-ns/test-skill", "claude-code", { yes: true })

		const command = await getCommand()
		expect(command).toContain("--agent claude-code")
		expect(command).toMatch(/-y$/)
	})

	test("all options — maps every flag", async () => {
		const { installSkill } = await import("../skill-install")
		await installSkill("test-ns/test-skill", "cursor", {
			global: true,
			yes: true,
			copy: true,
		})

		const command = await getCommand()
		expect(command).toContain("--agent cursor")
		expect(command).toContain("-g")
		expect(command).toContain("-y")
		expect(command).toContain("--copy")
	})
})

describe("setup command flow (the remaining installSkill consumer)", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("setup passes global and yes by default", async () => {
		const { installSkill } = await import("../skill-install")

		// Mirrors what `setup` does:
		// installSkill("smithery-ai/cli", agent, { global: true, yes: true })
		await installSkill("smithery-ai/cli", undefined, {
			global: true,
			yes: true,
		})

		const command = await getCommand()
		expect(command).toContain("-g")
		expect(command).toMatch(/-y$/)
	})
})
