/// <reference types="jest" />

import { collectConfigValues, validateAndFormatConfig } from "../utils/config"
import * as registry from "../registry"
import inquirer from "inquirer"
import type { ConnectionDetails } from "../types/registry"
// Mock external calls
jest.mock("../registry", () => ({
	fetchConfigWithApiKey: jest.fn(),
}))

jest.mock("inquirer", () => ({
	prompt: jest.fn(),
}))

// Get typed references to our mocked dependencies
const mockFetchConfig = registry.fetchConfigWithApiKey as jest.MockedFunction<
	typeof registry.fetchConfigWithApiKey
>
const mockPrompt = inquirer.prompt as jest.MockedFunction<
	typeof inquirer.prompt
>

describe("Server Configuration", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Test data
	const mockConnection: ConnectionDetails = {
		type: "stdio",
		stdioFunction: "npx",
		configSchema: {
			required: ["apiKey", "region"],
			properties: {
				apiKey: {
					type: "string",
					description: "API Key for authentication",
				},
				region: {
					type: "string",
					description: "Server region",
					default: "us-west",
				},
				maxTokens: {
					type: "integer",
					description: "Maximum tokens to generate",
					default: 1000,
				},
				useCache: {
					type: "boolean",
					description: "Whether to use caching",
				},
				tags: {
					type: "array",
					description: "Tags for categorization",
				},
			},
		},
	}

	describe("collectConfigValues", () => {
		test("should use existing values when provided", async () => {
			const existingValues = {
				apiKey: "test-key",
				region: "eu-central",
				useCache: true,
			}

			const result = await collectConfigValues(mockConnection, existingValues)

			const expectedValues = {
				apiKey: "test-key",
				region: "eu-central",
				useCache: true,
				maxTokens: 1000, // Default from schema
				// tags omitted as optional field with no value
			}

			expect(result).toEqual(expectedValues)
			expect(mockFetchConfig).not.toHaveBeenCalled()
			expect(mockPrompt).not.toHaveBeenCalled()
		})

		test("should return empty config if no schema properties", async () => {
			const connectionWithoutSchema: ConnectionDetails = {
				type: "stdio",
				stdioFunction: "npx",
				// No configSchema
			}

			const result = await collectConfigValues(connectionWithoutSchema)

			expect(result).toEqual({})
			expect(mockFetchConfig).not.toHaveBeenCalled()
			expect(mockPrompt).not.toHaveBeenCalled()
		})

		test("should prompt for missing required values", async () => {
			mockPrompt.mockResolvedValueOnce({ value: "prompt-key" })
			mockPrompt.mockResolvedValueOnce({ value: "prompt-region" })

			const result = await collectConfigValues(mockConnection)

			expect(mockPrompt).toHaveBeenCalledTimes(2)
			expect(result).toHaveProperty("apiKey", "prompt-key")
			expect(result).toHaveProperty("region", "prompt-region")
			expect(result).toHaveProperty("maxTokens", 1000) // Default value
		})
	})

	describe("formatAndValidateConfig", () => {
		test("should validate complete config successfully", async () => {
			const completeConfig = {
				apiKey: "test-key",
				region: "us-east",
				maxTokens: 1000, // Added required default
			}

			const result = await validateAndFormatConfig(
				mockConnection,
				completeConfig,
			)

			expect(result).toEqual(completeConfig)
		})

		test("should throw error for incomplete config", async () => {
			const incompleteConfig = {
				region: "us-east", // missing apiKey
			}

			await expect(
				validateAndFormatConfig(mockConnection, incompleteConfig),
			).rejects.toThrow("Missing required config values: apiKey")
		})

		test("should return empty object when no schema exists", async () => {
			const connectionWithoutSchema: ConnectionDetails = {
				type: "stdio",
				stdioFunction: "npx",
			}

			const anyConfig = { randomField: "value" }
			const result = await validateAndFormatConfig(
				connectionWithoutSchema,
				anyConfig,
			)

			expect(result).toEqual({})
		})

		test("should handle undefined config", async () => {
			const result = await validateAndFormatConfig(mockConnection, undefined)

			expect(result).toEqual({})
		})
	})
})
