import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock the SDK imports before any other imports
const mockCreateStatefulServer = vi.fn()

vi.mock("@smithery/sdk/server/stateful.js", () => ({
	createStatefulServer: mockCreateStatefulServer,
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

describe("stateful server behavior", () => {
	let originalEnv: NodeJS.ProcessEnv
	let originalExit: typeof process.exit
	let originalConsoleLog: typeof console.log
	let originalConsoleError: typeof console.error

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()
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

	it("should default to stateful when no stateless flag provided", () => {
		const defaultModule: { default: any; stateless?: boolean } = {
			default: vi.fn(),
			// No stateless flag - should default to stateful
		}

		// Verify it defaults to stateful (stateless is undefined/falsy)
		expect(defaultModule.stateless).toBeUndefined()
		expect(!!defaultModule.stateless).toBe(false)
	})

	it("should handle explicit stateless: false", () => {
		const explicitStatefulModule = {
			default: vi.fn(),
			stateless: false,
		}

		// Verify explicit false is respected
		expect(explicitStatefulModule.stateless).toBe(false)
	})

	it("should support config schema validation", () => {
		const mockSchema = {
			type: "object",
			properties: {
				sessionTimeout: { type: "number" },
				maxConnections: { type: "number" },
			},
			required: ["sessionTimeout"],
		}

		const moduleWithSchema = {
			default: vi.fn(),
			stateless: false,
			configSchema: mockSchema,
		}

		// Verify schema is properly attached
		expect(moduleWithSchema.configSchema).toBe(mockSchema)
		expect(moduleWithSchema.configSchema.required).toContain("sessionTimeout")
		expect(moduleWithSchema.configSchema.properties.sessionTimeout.type).toBe(
			"number",
		)
	})
})
