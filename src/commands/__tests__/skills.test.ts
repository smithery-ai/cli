/**
 * Skills Command Tests
 * Validates that skills search and install use public API (no auth required)
 */

import { beforeEach, describe, expect, test, vi } from "vitest"

function createSmitheryMock() {
	return {
		Smithery: vi.fn().mockImplementation((config) => ({
			_config: config,
			skills: {
				list: vi.fn().mockResolvedValue({
					skills: [
						{
							id: "test-id",
							namespace: "test-ns",
							slug: "test-skill",
							displayName: "Test Skill",
							description: "A test skill",
						},
					],
				}),
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

describe("skills commands use public API", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("skills search creates Smithery client with empty API key", async () => {
		const { searchSkills } = await import("../skill/search")

		// Run search in JSON mode to avoid interactive prompts
		await searchSkills("test", { json: true, limit: 5 })

		// Verify Smithery was instantiated with empty API key
		expect(Smithery).toHaveBeenCalledWith({ apiKey: "" })
	})

	test("skills install resolves skill URL with empty API key", async () => {
		const { execSync } = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		await installSkill("test-ns/test-skill", "claude-code", {})

		// Verify Smithery was instantiated with empty API key for skill resolution
		expect(Smithery).toHaveBeenCalledWith({ apiKey: "" })

		// Verify the install command was executed
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("npx -y skills add"),
			expect.any(Object),
		)
	})

	test("skills install passes global flag correctly", async () => {
		const { execSync } = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		await installSkill("test-ns/test-skill", "cursor", { global: true })

		// Verify -g flag is included in command
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("-g"),
			expect.any(Object),
		)
	})

	test("skills install includes -y flag when both skill and agent provided", async () => {
		const { execSync } = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		await installSkill("test-ns/test-skill", "claude-code", {})

		const command = (execSync as ReturnType<typeof vi.fn>).mock.calls[0][0]
		// Trailing -y should be present for non-interactive mode
		expect(command).toMatch(/-y$/)
	})

	test("skills install runs interactive when no agent provided", async () => {
		const { execSync } = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		await installSkill("test-ns/test-skill", undefined, {})

		const command = (execSync as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(command).toContain(
			"npx -y skills add https://smithery.ai/skills/test-ns/test-skill",
		)
		// Should NOT have trailing -y
		expect(command).not.toMatch(/-y$/)
	})
})
