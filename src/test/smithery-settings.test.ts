/// <reference types="jest" />

import * as smitheryConfig from "../smithery-config"
import { promises as fs } from "node:fs"

// Mock the fs module
jest.mock("node:fs", () => ({
	promises: {
		mkdir: jest.fn(),
		writeFile: jest.fn(),
		readFile: jest.fn(),
		access: jest.fn(),
		appendFile: jest.fn(),
	},
}))

// Mock console.warn to prevent test output pollution
jest.spyOn(console, "warn").mockImplementation(() => {})

jest.mock("inquirer")

// Mock the uuid module to return a predictable ID
jest.mock("uuid", () => ({
	v4: jest.fn().mockReturnValue("test-uuid-1234"),
}))

describe("Smithery Config", () => {
	beforeEach(() => {
		// Clear all mocks before each test
		jest.clearAllMocks()

		// Reset module state
		jest.resetModules()

		// Reset environment variable
		process.env.SMITHERY_CONFIG_PATH = undefined

		// Reset the internal state of the module
		// @ts-ignore - accessing private variables for testing
		smitheryConfig.settingsData = null
		// @ts-ignore - accessing private variables for testing
		smitheryConfig.isInitialized = false
	})

	it("should create default settings when none exist", async () => {
		// Mock readFile to throw ENOENT (file not found)
		const mockError = new Error("File not found")
		;(mockError as any).code = "ENOENT"
		;(fs.readFile as jest.Mock).mockRejectedValueOnce(mockError)

		// Mock successful mkdir
		;(fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined)

		// Mock successful write
		;(fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined)

		const result = await smitheryConfig.initializeSettings()

		expect(result.success).toBe(true)
		expect(result.data).toEqual({
			userId: "test-uuid-1234",
			analyticsConsent: false,
			askedConsent: false,
			cache: { servers: {} },
		})

		// Verify that writeFile was called with default settings
		expect(fs.writeFile).toHaveBeenCalledWith(
			expect.stringContaining("settings.json"),
			expect.stringContaining("test-uuid-1234"),
		)
	})

	it("should get user ID after initialization", async () => {
		// Mock readFile to throw ENOENT (file not found)
		const mockError = new Error("File not found")
		;(mockError as any).code = "ENOENT"
		;(fs.readFile as jest.Mock).mockRejectedValueOnce(mockError)

		// Mock successful mkdir
		;(fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined)

		// Mock successful write
		;(fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined)

		const userId = await smitheryConfig.getUserId()

		expect(userId).toBe("test-uuid-1234")
	})
})
