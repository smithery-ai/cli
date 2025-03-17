/// <reference types="jest" />

import { createWSRunner } from "../commands/run/ws-runner"
import { ProxyTransport } from "../commands/run/proxy-transport"

// Mock the ProxyTransport class
jest.mock("../commands/run/proxy-transport", () => {
	return {
		ProxyTransport: jest.fn().mockImplementation(() => ({
			start: jest.fn().mockResolvedValue(undefined),
			send: jest.fn().mockResolvedValue(undefined),
			close: jest.fn().mockResolvedValue(undefined),
			onclose: null,
			onerror: null,
			onmessage: null,
		})),
	}
})

// Mock console methods to prevent test output pollution
jest.spyOn(console, "error").mockImplementation(() => {})
jest.spyOn(console, "log").mockImplementation(() => {})

// Mock process methods
const mockExit = jest
	.spyOn(process, "exit")
	.mockImplementation(() => undefined as never)

// Mock process.on and process.stdin.on
const originalOn = process.on
const originalStdinOn = process.stdin.on
const mockProcessOn = jest.fn()
const mockStdinOn = jest.fn()

describe("WebSocket Runner", () => {
	let mockTransport: any

	beforeEach(() => {
		// Clear all mocks before each test
		jest.clearAllMocks()

		// Reset module state
		jest.resetModules()

		// Setup process.on mock
		process.on = mockProcessOn
		process.stdin.on = mockStdinOn

		// Reset the ProxyTransport mock
		mockTransport = {
			start: jest.fn().mockResolvedValue(undefined),
			send: jest.fn().mockResolvedValue(undefined),
			close: jest.fn().mockResolvedValue(undefined),
			onclose: null,
			onerror: null,
			onmessage: null,
		}

		// Setup the ProxyTransport constructor mock
		;(ProxyTransport as jest.Mock).mockImplementation(() => mockTransport)
	})

	afterEach(() => {
		// Restore original process.on and process.stdin.on
		process.on = originalOn
		process.stdin.on = originalStdinOn
	})

	it("should create a WebSocket runner with proper configuration", async () => {
		const baseUrl = "http://localhost:3000"
		const config = { apiKey: "test-key" }

		const cleanup = await createWSRunner(baseUrl, config)

		// Verify ProxyTransport was created with correct parameters
		expect(ProxyTransport).toHaveBeenCalledWith(
			baseUrl,
			config,
			expect.objectContaining({
				idleTimeout: 5 * 60 * 1000,
				maxBuffer: 100,
			}),
		)

		// Verify transport.start was called
		expect(mockTransport.start).toHaveBeenCalled()

		// Verify event handlers were set up
		expect(mockProcessOn).toHaveBeenCalledWith("SIGINT", expect.any(Function))
		expect(mockProcessOn).toHaveBeenCalledWith("SIGTERM", expect.any(Function))
		expect(mockStdinOn).toHaveBeenCalledWith("data", expect.any(Function))

		// Verify cleanup function was returned
		expect(cleanup).toBeInstanceOf(Function)
	})

	it("should handle incoming messages correctly", async () => {
		const baseUrl = "http://localhost:3000"
		const config = { apiKey: "test-key" }

		await createWSRunner(baseUrl, config)

		// Get the data handler function that was registered
		const dataHandler = mockStdinOn.mock.calls[0][1]

		// Create a test message
		const testMessage = JSON.stringify({ method: "test", params: {} })
		const buffer = Buffer.from(`${testMessage}\n`)

		// Call the data handler with the test message
		await dataHandler(buffer)

		// Verify the message was sent through the transport
		expect(mockTransport.send).toHaveBeenCalledWith(JSON.parse(testMessage))
	})

	it("should handle transport messages correctly", async () => {
		const baseUrl = "http://localhost:3000"
		const config = { apiKey: "test-key" }

		await createWSRunner(baseUrl, config)

		// Simulate a message from the transport
		const testMessage = { result: "test-result" }
		mockTransport.onmessage(testMessage)

		// Verify the message was logged
		expect(console.log).toHaveBeenCalledWith(JSON.stringify(testMessage))
	})

	it("should handle error messages correctly", async () => {
		const baseUrl = "http://localhost:3000"
		const config = { apiKey: "test-key" }

		await createWSRunner(baseUrl, config)

		// Simulate an error message from the transport
		const errorMessage = { error: { message: "Test error" } }
		mockTransport.onmessage(errorMessage)

		// Verify the error was logged
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("WebSocket error"),
		)
		expect(console.log).toHaveBeenCalledWith(JSON.stringify(errorMessage))
	})

	it("should exit on critical error messages", async () => {
		const baseUrl = "http://localhost:3000"
		const config = { apiKey: "test-key" }

		await createWSRunner(baseUrl, config)

		// Simulate a critical error message from the transport
		const criticalErrorMessage = { error: { message: "Missing configuration" } }

		// Call the message handler
		mockTransport.onmessage(criticalErrorMessage)

		// Verify process.exit was called
		expect(mockExit).toHaveBeenCalledWith(1)
	})

	it("should handle transport errors correctly", async () => {
		const baseUrl = "http://localhost:3000"
		const config = { apiKey: "test-key" }

		await createWSRunner(baseUrl, config)

		// Simulate a transport error
		const testError = new Error("Test transport error")

		// Call the error handler
		mockTransport.onerror(testError)

		// Verify error was logged and process.exit was called
		expect(mockExit).toHaveBeenCalledWith(1)
	})

	it("should perform cleanup on exit", async () => {
		const baseUrl = "http://localhost:3000"
		const config = { apiKey: "test-key" }

		await createWSRunner(baseUrl, config)

		// Get the exit handler function that was registered for SIGINT
		const exitHandler = mockProcessOn.mock.calls.find(
			(call) => call[0] === "SIGINT",
		)[1]

		// Temporarily replace process.exit to prevent test from exiting
		const originalExit = process.exit
		process.exit = jest.fn() as any

		// Call the exit handler
		await exitHandler()

		// Restore process.exit
		process.exit = originalExit

		// Verify transport.close was called
		expect(mockTransport.close).toHaveBeenCalled()
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Shutting down WS Runner"),
		)
	})

	it("should handle cleanup errors gracefully", async () => {
		const baseUrl = "http://localhost:3000"
		const config = { apiKey: "test-key" }

		// Make transport.close throw an error
		const testError = new Error("Test cleanup error")
		mockTransport.close.mockRejectedValueOnce(testError)

		const cleanup = await createWSRunner(baseUrl, config)

		// Reset console.error mock to clear previous calls
		jest.clearAllMocks()

		// Call the cleanup function
		await cleanup()

		// Check that handleError was called with the error
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Error during cleanup:"),
			expect.any(String),
		)
	})

	it("should handle transport close and attempt reconnection", async () => {
		// Set timeout to avoid test timeout
		jest.setTimeout(10000)

		const baseUrl = "http://localhost:3000"
		const config = { apiKey: "test-key" }

		await createWSRunner(baseUrl, config)

		// Reset mocks to track new calls
		jest.clearAllMocks()

		// Setup a new ProxyTransport mock for the reconnection
		const secondTransport = {
			start: jest.fn().mockResolvedValue(undefined),
			send: jest.fn().mockResolvedValue(undefined),
			close: jest.fn().mockResolvedValue(undefined),
			onclose: null,
			onerror: null,
			onmessage: null,
		}

		// Setup the ProxyTransport constructor to return the second transport on next call
		;(ProxyTransport as jest.Mock).mockImplementationOnce(() => secondTransport)

		// Mock setTimeout to execute immediately
		jest.spyOn(global, "setTimeout").mockImplementation((cb: any) => {
			cb()
			return {} as any
		})

		// Simulate transport close
		await mockTransport.onclose()

		// Verify a new transport was created
		expect(ProxyTransport).toHaveBeenCalledTimes(1)
	})
})
