import { vi } from "vitest"

// Mock console methods to avoid noise in tests
global.console = {
	...console,
	log: vi.fn(),
	error: vi.fn(),
	warn: vi.fn(),
	info: vi.fn(),
}

// Mock process.exit to prevent tests from exiting
vi.spyOn(process, "exit").mockImplementation(() => {
	throw new Error("process.exit() was called")
})
