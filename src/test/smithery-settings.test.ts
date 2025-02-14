/// <reference types="jest" />

import { SmitherySettings } from "../utils/smithery-settings"
import { promises as fs } from "node:fs"
import inquirer from "inquirer"
import { join } from "node:path"
import { homedir, platform } from "node:os"

// Mock the fs and inquirer modules
jest.mock("node:fs", () => ({
    promises: {
        mkdir: jest.fn(),
        writeFile: jest.fn(),
        readFile: jest.fn(),
        access: jest.fn(),
        appendFile: jest.fn(),
    },
}))

jest.mock("inquirer")

describe("SmitherySettings", () => {
    let settings: SmitherySettings

    beforeEach(() => {
        settings = new SmitherySettings()
        // Clear all mocks before each test
        jest.clearAllMocks()
        // Reset static property
        SmitherySettings['CUSTOM_CONFIG_PATH'] = null
    })

    it("should handle non-writable path by prompting for custom path", async () => {
        // Mock mkdir to throw EACCES error
        const mockError = new Error("Permission denied")
        ;(mockError as any).code = "EACCES"
        ;(fs.mkdir as jest.Mock).mockRejectedValueOnce(mockError)

        // Mock inquirer to simulate user choosing custom path
        ;(inquirer.prompt as unknown as jest.Mock).mockResolvedValueOnce({
            action: "custom",
        }).mockResolvedValueOnce({
            customPath: "/custom/path"
        })

        // Mock fs.access to simulate the custom path being writable
        ;(fs.access as jest.Mock).mockResolvedValueOnce(undefined)

        await settings.initialize()

        // Verify that mkdir was called
        expect(fs.mkdir).toHaveBeenCalled()

        // Verify that inquirer prompted the user
        expect(inquirer.prompt).toHaveBeenCalledTimes(2)

        // Verify that writeFile was called with the new custom path
        expect(fs.writeFile).toHaveBeenCalled()
    })

    it("should handle skip option by running in memory-only mode", async () => {
        // Mock mkdir to throw EACCES error
        const mockError = new Error("Permission denied")
        ;(mockError as any).code = "EACCES"
        ;(fs.mkdir as jest.Mock).mockRejectedValueOnce(mockError)

        // Mock user choosing skip
        ;(inquirer.prompt as unknown as jest.Mock).mockResolvedValueOnce({
            action: "skip"
        })

        await settings.initialize()

        // Should have userId but not save to disk
        expect(settings.getUserId()).toBeTruthy()
        expect(fs.writeFile).not.toHaveBeenCalled()
    })

    it("should use the custom path for saving settings", async () => {
        const mockError = new Error("Permission denied")
        ;(mockError as any).code = "EACCES"
        ;(fs.mkdir as jest.Mock).mockRejectedValueOnce(mockError)

        const customPath = "/custom/path"
        
        // Set custom path BEFORE creating instance
        SmitherySettings['CUSTOM_CONFIG_PATH'] = customPath
        settings = new SmitherySettings()  // Create new instance after setting path

        ;(inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ action: "custom" })
            .mockResolvedValueOnce({ customPath })

        ;(fs.access as jest.Mock).mockResolvedValueOnce(undefined)

        await settings.initialize()

        expect(fs.writeFile).toHaveBeenCalledWith(
            join(customPath, "settings.json"),
            expect.any(String)
        )
    })

    it("should attempt to modify shell profile when custom path is chosen", async () => {
        const mockError = new Error("Permission denied")
        ;(mockError as any).code = "EACCES"
        ;(fs.mkdir as jest.Mock).mockRejectedValueOnce(mockError)

        const customPath = "/custom/path"
        ;(inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ action: "custom" })
            .mockResolvedValueOnce({ customPath })

        ;(fs.access as jest.Mock).mockResolvedValueOnce(undefined)

        // Get expected profile path based on platform
        const profilePath = platform() === "win32"
            ? join(homedir(), "Documents", "WindowsPowerShell", "profile.ps1")
            : join(homedir(), ".bashrc")

        await settings.initialize()

        // Verify attempt to modify shell profile
        expect(fs.appendFile).toHaveBeenCalledWith(
            profilePath,
            expect.stringContaining(customPath)
        )
    })

    it("should use SMITHERY_CONFIG_PATH environment variable when set", async () => {
        // Store original env value
        const originalEnvPath = process.env.SMITHERY_CONFIG_PATH
        
        // Set environment variable
        const envPath = "/env/custom/path"
        process.env.SMITHERY_CONFIG_PATH = envPath

        // Create new settings instance to use new env var
        settings = new SmitherySettings()
        await settings.initialize()

        // Verify settings are written to env path
        expect(fs.writeFile).toHaveBeenCalledWith(
            join(envPath, "settings.json"),
            expect.any(String)
        )

        // Restore original env value
        process.env.SMITHERY_CONFIG_PATH = originalEnvPath
    })
}) 