import { beforeEach, describe, expect, test, vi } from "vitest"

const {
	mockGetProfile,
	mockSwitchProfile,
	mockGetProfiles,
	mockSaveProfile,
	mockRemoveProfile,
} = vi.hoisted(() => ({
	mockGetProfile: vi.fn(),
	mockSwitchProfile: vi.fn(),
	mockGetProfiles: vi.fn(),
	mockSaveProfile: vi.fn(),
	mockRemoveProfile: vi.fn(),
}))

vi.mock("../../utils/smithery-settings", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../../utils/smithery-settings")>()
	return {
		...actual,
		getProfile: mockGetProfile,
		switchProfile: mockSwitchProfile,
		getProfiles: mockGetProfiles,
		saveProfile: mockSaveProfile,
		removeProfile: mockRemoveProfile,
	}
})

import { switchNamespace } from "../namespace/switch"

describe("namespace switch command", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("switches to cached profile successfully", async () => {
		const profile = {
			apiKey: "sk-test-key",
			namespace: "my-org",
			authOrganization: {
				id: "org_123",
				name: "My Org",
			},
		}

		mockGetProfile.mockResolvedValue(profile)
		mockSwitchProfile.mockResolvedValue({ success: true })

		const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})

		await switchNamespace("my-org")

		expect(mockGetProfile).toHaveBeenCalledWith("my-org")
		expect(mockSwitchProfile).toHaveBeenCalledWith("my-org")
		expect(consoleLog).toHaveBeenCalledWith(
			expect.stringContaining("Switched to namespace: my-org"),
		)

		consoleLog.mockRestore()
	})

	test("fails when profile not found", async () => {
		mockGetProfile.mockResolvedValue(undefined)
		mockGetProfiles.mockResolvedValue({
			"other-org": {
				apiKey: "sk-other",
				namespace: "other-org",
			},
		})

		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {})
		const processExit = vi
			.spyOn(process, "exit")
			.mockImplementation((() => {
				throw new Error("process.exit called")
			}) as never)

		await expect(switchNamespace("missing-org")).rejects.toThrow(
			"process.exit called",
		)

		expect(mockGetProfile).toHaveBeenCalledWith("missing-org")
		expect(consoleError).toHaveBeenCalledWith(
			expect.stringContaining('Profile "missing-org" not found'),
		)
		expect(processExit).toHaveBeenCalledWith(1)

		consoleError.mockRestore()
		processExit.mockRestore()
	})

	test("shows available profiles when target not found", async () => {
		mockGetProfile.mockResolvedValue(undefined)
		mockGetProfiles.mockResolvedValue({
			"org-1": {
				apiKey: "sk-1",
				namespace: "org-1",
			},
			"org-2": {
				apiKey: "sk-2",
				namespace: "org-2",
			},
		})

		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {})
		const processExit = vi
			.spyOn(process, "exit")
			.mockImplementation((() => {
				throw new Error("process.exit called")
			}) as never)

		await expect(switchNamespace("missing")).rejects.toThrow(
			"process.exit called",
		)

		expect(consoleError).toHaveBeenCalledWith(
			expect.stringContaining("Available cached profiles: org-1, org-2"),
		)

		consoleError.mockRestore()
		processExit.mockRestore()
	})

	test("handles save profile during login flow", async () => {
		const profile = {
			apiKey: "sk-new-key",
			namespace: "new-org",
			authOrganization: {
				id: "org_456",
				name: "New Org",
			},
		}

		mockSaveProfile.mockResolvedValue({ success: true })

		await mockSaveProfile("new-org", profile)

		expect(mockSaveProfile).toHaveBeenCalledWith("new-org", profile)
	})

	test("handles backwards compatibility with old settings format", async () => {
		// Old settings without profiles field should still work
		mockGetProfiles.mockResolvedValue({})
		mockGetProfile.mockResolvedValue(undefined)

		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {})
		const processExit = vi
			.spyOn(process, "exit")
			.mockImplementation((() => {
				throw new Error("process.exit called")
			}) as never)

		await expect(switchNamespace("any-org")).rejects.toThrow(
			"process.exit called",
		)

		expect(consoleError).toHaveBeenCalledWith(
			expect.stringContaining("No profiles found"),
		)

		consoleError.mockRestore()
		processExit.mockRestore()
	})

	test("removes profile correctly", async () => {
		mockRemoveProfile.mockResolvedValue({ success: true })

		await mockRemoveProfile("old-org")

		expect(mockRemoveProfile).toHaveBeenCalledWith("old-org")
	})
})
