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
import { setOutputMode } from "../../utils/output"

describe("skills commands use public API", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("skills search creates Smithery client with empty API key", async () => {
		const { searchSkills } = await import("../skill/search")

		// Run search in JSON mode to avoid interactive prompts
		setOutputMode({ json: true })
		await searchSkills("test", { limit: 5 })

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

	test("skills install is interactive without yes option", async () => {
		const { execSync } = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		await installSkill("test-ns/test-skill", "claude-code", {})

		const command = (execSync as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(command).toContain("--agent claude-code")
		// Should not end with -y (the npx -y is a different flag)
		expect(command).not.toMatch(/-y$/)
	})

	test("skills install passes -y flag when yes option is set", async () => {
		const { execSync } = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		await installSkill("test-ns/test-skill", "claude-code", { yes: true })

		const command = (execSync as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(command).toContain("--agent claude-code")
		expect(command).toContain("-y")
	})

	test("skills install builds correct command with all options", async () => {
		const { execSync } = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		await installSkill("test-ns/test-skill", "cursor", {
			global: true,
			yes: true,
			copy: true,
		})

		const command = (execSync as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(command).toContain("--agent cursor")
		expect(command).toContain("-g")
		expect(command).toContain("-y")
		expect(command).toContain("--copy")
	})
})
