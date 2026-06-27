import { beforeEach, describe, expect, test, vi } from "vitest"
import type { ClientDefinition } from "../../../config/clients"
import { runConfigCommand } from "../../client-config-io"

const { execFileSync } = vi.hoisted(() => ({
	execFileSync: vi.fn(),
}))

vi.mock("node:child_process", () => ({
	execFileSync,
}))

vi.mock("../../lib/logger", () => ({
	verbose: vi.fn(),
}))

describe("runConfigCommand", () => {
	const clientConfig: ClientDefinition = {
		label: "Claude Code",
		install: {
			method: "command",
			command: "claude",
			templates: {
				stdio: (_name, command, args) => ["mcp", "add", command, ...args],
			},
		},
		transports: { stdio: {} },
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("throws a client-aware error when the CLI binary is missing", () => {
		const error = Object.assign(new Error("spawn claude ENOENT"), {
			code: "ENOENT",
		})
		execFileSync.mockImplementation(() => {
			throw error
		})

		expect(() =>
			runConfigCommand(
				{
					mcpServers: {
						gmail: { command: "npx", args: ["-y", "gmail-mcp"] },
					},
				},
				clientConfig,
			),
		).toThrow(
			"Could not run Claude Code: 'claude' was not found on PATH. Install the Claude Code CLI and ensure it is available in your shell.",
		)
	})
})
