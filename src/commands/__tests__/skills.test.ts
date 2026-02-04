/**
 * Skills Command Tests
 * Validates that skills search and install use public API (no auth required)
 */

import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock the Smithery client
vi.mock("@smithery/api/client.js", () => ({
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
}))

// Mock child_process for install
vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}))

// Mock console methods
vi.spyOn(console, "log").mockImplementation(() => {})
vi.spyOn(console, "error").mockImplementation(() => {})

import { Smithery } from "@smithery/api/client.js"

describe("skills commands use public API", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("skills search creates Smithery client with empty API key", async () => {
		const { searchSkills } = await import("../skills/search")

		// Run search in JSON mode to avoid interactive prompts
		await searchSkills("test", { json: true, limit: 5 })

		// Verify Smithery was instantiated with empty API key
		expect(Smithery).toHaveBeenCalledWith({ apiKey: "" })
	})

	test("skills install resolves skill URL with empty API key", async () => {
		const { execSync } = await import("node:child_process")
		const { installSkill } = await import("../skills/install")

		await installSkill("test-ns/test-skill", "claude-code", {})

		// Verify Smithery was instantiated with empty API key for skill resolution
		expect(Smithery).toHaveBeenCalledWith({ apiKey: "" })

		// Verify the install command was executed
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("npx skills add"),
			expect.any(Object),
		)
	})

	test("skills install passes global flag correctly", async () => {
		const { execSync } = await import("node:child_process")
		const { installSkill } = await import("../skills/install")

		await installSkill("test-ns/test-skill", "cursor", { global: true })

		// Verify -g flag is included in command
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("-g"),
			expect.any(Object),
		)
	})

	test("skills install includes -y flag for auto-confirm", async () => {
		const { execSync } = await import("node:child_process")
		const { installSkill } = await import("../skills/install")

		await installSkill("test-ns/test-skill", "claude-code", {})

		// Verify -y flag is included
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("-y"),
			expect.any(Object),
		)
	})
})
