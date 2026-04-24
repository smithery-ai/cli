import { describe, expect, test, vi } from "vitest"
import { classifyAddTarget, extractAddInvocation } from "../mcp/uplink-target"

describe("extractAddInvocation", () => {
	test("keeps a positional server when no uplink command is provided", () => {
		const result = extractAddInvocation([
			"node",
			"cli",
			"mcp",
			"add",
			"http://localhost:9090/mcp",
			"--id",
			"chrome",
		])

		expect(result).toEqual({
			server: "http://localhost:9090/mcp",
			commandTokens: [],
		})
	})

	test("keeps a positional server when option values are passed inline", () => {
		const result = extractAddInvocation([
			"node",
			"cli",
			"mcp",
			"add",
			"--id=chrome",
			"http://localhost:9090/mcp",
		])

		expect(result).toEqual({
			server: "http://localhost:9090/mcp",
			commandTokens: [],
		})
	})

	test("extracts a stdio command passed after -- without inventing a server", () => {
		const result = extractAddInvocation([
			"node",
			"cli",
			"mcp",
			"add",
			"--id",
			"chrome",
			"--",
			"npx",
			"-y",
			"foo",
		])

		expect(result).toEqual({
			server: undefined,
			commandTokens: ["npx", "-y", "foo"],
		})
	})

	test("preserves an optional pre-command hint before --", () => {
		const result = extractAddInvocation([
			"node",
			"cli",
			"mcp",
			"add",
			"chrome",
			"--",
			"npx",
			"-y",
			"foo",
		])

		expect(result).toEqual({
			server: "chrome",
			commandTokens: ["npx", "-y", "foo"],
		})
	})

	test("finds the actual mcp add command when the local command also contains add", () => {
		const result = extractAddInvocation([
			"node",
			"cli",
			"mcp",
			"add",
			"--",
			"cargo",
			"add",
			"foo",
		])

		expect(result).toEqual({
			server: undefined,
			commandTokens: ["cargo", "add", "foo"],
		})
	})
})

describe("classifyAddTarget", () => {
	test("treats stdio commands as uplink stdio targets", async () => {
		const result = await classifyAddTarget({
			commandTokens: ["npx", "-y", "@modelcontextprotocol/server-everything"],
		})

		expect(result).toEqual({
			kind: "uplink-stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-everything"],
		})
	})

	test("treats literal loopback URLs as uplink http targets", async () => {
		const result = await classifyAddTarget({
			server: "http://127.0.0.1:9090/mcp",
		})

		expect(result).toEqual({
			kind: "uplink-http",
			mcpUrl: "http://127.0.0.1:9090/mcp",
		})
	})

	test("treats loopback-resolving hosts as uplink http targets", async () => {
		const result = await classifyAddTarget(
			{ server: "http://devbox:9090/mcp" },
			{
				lookup: vi
					.fn()
					.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]),
			},
		)

		expect(result).toEqual({
			kind: "uplink-http",
			mcpUrl: "http://devbox:9090/mcp",
		})
	})

	test("leaves non-loopback URLs on the normal http path", async () => {
		const result = await classifyAddTarget(
			{ server: "https://server.smithery.ai/exa" },
			{
				lookup: vi
					.fn()
					.mockResolvedValue([{ address: "34.117.59.81", family: 4 }]),
			},
		)

		expect(result).toEqual({
			kind: "http",
			server: "https://server.smithery.ai/exa",
		})
	})
})
