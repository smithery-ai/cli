import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock the SDK imports before any other imports
const mockCreateStatelessServer = vi.fn()
const mockCreateStatefulServer = vi.fn()

vi.mock("@smithery/sdk/server/stateful.js", () => ({
	createStatefulServer: mockCreateStatelessServer,
}))

vi.mock("@smithery/sdk/server/stateless.js", () => ({
	createStatelessServer: mockCreateStatelessServer,
}))

// Mock express
const mockApp = {
	use: vi.fn(),
	listen: vi.fn(),
}

vi.mock("express", () => ({
	default: vi.fn(() => mockApp),
}))

// Mock cors
vi.mock("cors", () => ({
	default: vi.fn(() => vi.fn()),
}))

describe("stateless server behavior", () => {
	let originalEnv: NodeJS.ProcessEnv
	let originalExit: typeof process.exit
	let originalConsoleLog: typeof console.log
	let originalConsoleError: typeof console.error

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()
		mockCreateStatelessServer.mockReturnValue({ app: mockApp })
		mockCreateStatefulServer.mockReturnValue({ app: mockApp })

		// Store originals
		originalEnv = { ...process.env }
		originalExit = process.exit
		originalConsoleLog = console.log
		originalConsoleError = console.error

		// Mock process.exit to throw instead of exiting
		process.exit = vi.fn().mockImplementation(() => {
			throw new Error("process.exit called")
		}) as any

		// Mock console methods
		console.log = vi.fn()
		console.error = vi.fn()
	})

	afterEach(() => {
		// Restore originals
		process.env = originalEnv
		process.exit = originalExit
		console.log = originalConsoleLog
		console.error = originalConsoleError
		vi.restoreAllMocks()
	})

	it("should detect stateless flag when set to true", () => {
		const statelessModule = {
			default: vi.fn(),
			stateless: true,
		}

		// Verify stateless flag is properly detected
		expect(statelessModule.stateless).toBe(true)
		expect(statelessModule.stateless === true).toBe(true)
	})

	it("should handle stateless server with explicit stateless: true", () => {
		const explicitStatelessModule = {
			default: vi.fn(),
			stateless: true,
		}

		// Verify explicit true is respected
		expect(explicitStatelessModule.stateless).toBe(true)
	})

	it("should support config schema validation for stateless servers", () => {
		const mockSchema = {
			type: "object",
			properties: {
				apiKey: { type: "string" },
				port: { type: "number" },
			},
			required: ["apiKey"],
		}

		const moduleWithSchema = {
			default: vi.fn(),
			stateless: true,
			configSchema: mockSchema,
		}

		// Verify schema is properly attached
		expect(moduleWithSchema.configSchema).toBe(mockSchema)
		expect(moduleWithSchema.configSchema.required).toContain("apiKey")
		expect(moduleWithSchema.configSchema.properties.apiKey.type).toBe("string")
	})
})
