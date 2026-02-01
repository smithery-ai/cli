/**
 * Unit tests for formatServerConfig function
 */

import { describe, expect, test } from "vitest"
import { formatServerConfig } from "../../../lib/client-config-io"

describe("formatServerConfig", () => {
	test("should return http config for http-oauth transport", () => {
		// ARRANGE
		const qualifiedName = "@test/http-server"

		// ACT
		const result = formatServerConfig(qualifiedName, "http-oauth")

		// ASSERT
		expect(result).toEqual({
			type: "http",
			url: `https://server.smithery.ai/${qualifiedName}/mcp`,
			headers: {},
		})
	})

	test("should return mcp-remote config for http-proxy transport", () => {
		// ARRANGE
		const qualifiedName = "@test/http-server"

		// ACT
		const result = formatServerConfig(qualifiedName, "http-proxy")

		// ASSERT
		expect(result).toEqual({
			command: "npx",
			args: [
				"-y",
				"mcp-remote",
				`https://server.smithery.ai/${qualifiedName}/mcp`,
			],
		})
	})

	test("should return stdio config for stdio transport", () => {
		// ARRANGE
		const qualifiedName = "@test/stdio-server"

		// ACT
		const result = formatServerConfig(qualifiedName, "stdio")

		// ASSERT
		expect(result).toEqual({
			command: "npx",
			args: ["-y", "@smithery/cli@latest", "run", qualifiedName],
		})
	})
})
