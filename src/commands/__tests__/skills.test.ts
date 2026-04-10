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
	execFileSync: vi.fn(),
}))

// Mock console methods
vi.spyOn(console, "log").mockImplementation(() => {})
vi.spyOn(console, "error").mockImplementation(() => {})

import { Smithery } from "@smithery/api"
import { setOutputMode } from "../../utils/output"

async function getArgs(): Promise<string[]> {
	const { execFileSync } = await import("node:child_process")
	return (execFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1]
}

/** Count how many times a value appears in an array */
function countOccurrences(arr: string[], value: string): number {
	return arr.filter((v) => v === value).length
}

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
		const { execFileSync } = await import("node:child_process")
		const { installSkill } = await import("../skill/install")

		await installSkill("test-ns/test-skill", "claude-code", {})

		expect(Smithery).toHaveBeenCalledWith({ apiKey: "" })
		expect(execFileSync).toHaveBeenCalledWith(
			"npx",
			expect.arrayContaining(["-y", "skills", "add"]),
			expect.any(Object),
		)
	})
})

describe("installSkill flag mapping", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("no agent, no options — interactive, no flags", async () => {
		const { installSkill } = await import("../skill/install")
		await installSkill("test-ns/test-skill")

		const args = await getArgs()
		expect(args).toEqual([
			"-y",
			"skills",
			"add",
			"https://smithery.ai/skills/test-ns/test-skill",
		])
	})

	test("with agent, no yes — adds --agent but no extra -y flag", async () => {
		const { installSkill } = await import("../skill/install")
		await installSkill("test-ns/test-skill", "claude-code", {})

		const args = await getArgs()
		expect(args).toContain("--agent")
		expect(args).toContain("claude-code")
		// Only the npx -y should be present, not an additional -y for yes option
		expect(countOccurrences(args, "-y")).toBe(1)
	})

	test("with agent and yes — adds --agent and -y", async () => {
		const { installSkill } = await import("../skill/install")
		await installSkill("test-ns/test-skill", "claude-code", { yes: true })

		const args = await getArgs()
		expect(args).toContain("--agent")
		expect(args).toContain("claude-code")
		// npx -y plus options -y = 2 occurrences
		expect(countOccurrences(args, "-y")).toBe(2)
	})

	test("all options — maps every flag", async () => {
		const { installSkill } = await import("../skill/install")
		await installSkill("test-ns/test-skill", "cursor", {
			global: true,
			yes: true,
			copy: true,
		})

		const args = await getArgs()
		expect(args).toContain("--agent")
		expect(args).toContain("cursor")
		expect(args).toContain("-g")
		expect(countOccurrences(args, "-y")).toBe(2)
		expect(args).toContain("--copy")
	})
})

describe("setup command flow", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("setup passes global and yes by default", async () => {
		const { installSkill } = await import("../skill/install")

		// Mirrors what setup does: installSkill("smithery-ai/cli", undefined, { global: true, yes: true })
		await installSkill("smithery-ai/cli", undefined, {
			global: true,
			yes: true,
		})

		const args = await getArgs()
		expect(args).toContain("-g")
		expect(countOccurrences(args, "-y")).toBe(2)
	})
})

describe("skill install command flow", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("with agent — non-interactive (yes: true)", async () => {
		const { installSkill } = await import("../skill/install")

		// Mirrors: installSkill(skill, agent, { global, yes: !!agent })
		await installSkill("test-ns/test-skill", "claude-code", { yes: true })

		const args = await getArgs()
		expect(args).toContain("--agent")
		expect(args).toContain("claude-code")
		expect(countOccurrences(args, "-y")).toBe(2)
	})

	test("without agent — interactive (yes: false)", async () => {
		const { installSkill } = await import("../skill/install")

		// Mirrors: installSkill(skill, undefined, { global, yes: false })
		await installSkill("test-ns/test-skill", undefined, { yes: false })

		const args = await getArgs()
		// Only the npx -y, no additional -y for yes option
		expect(countOccurrences(args, "-y")).toBe(1)
		expect(args).not.toContain("--agent")
	})
})
