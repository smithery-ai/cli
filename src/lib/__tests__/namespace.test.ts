/**
 * Namespace Library Unit Tests
 * Tests the resolveNamespace function in isolation
 */

import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock dependencies
vi.mock("@smithery/api", () => ({
	Smithery: vi.fn(),
}))

vi.mock("ora", () => ({
	default: vi.fn(() => ({
		start: vi.fn().mockReturnThis(),
		succeed: vi.fn().mockReturnThis(),
	})),
}))

vi.mock("../../utils/command-prompts", () => ({
	promptForNamespaceCreation: vi.fn(),
	promptForNamespaceSelection: vi.fn(),
}))

vi.mock("../errors", () => ({
	createError: vi.fn((error, message) => {
		const err = new Error(message)
		if (error instanceof Error) {
			err.cause = error
		}
		return err
	}),
}))

import type { Smithery } from "@smithery/api"
import {
	promptForNamespaceCreation,
	promptForNamespaceSelection,
} from "../../utils/command-prompts"
import { createError } from "../errors"
import { resolveNamespace } from "../namespace"

describe("resolveNamespace", () => {
	let mockClient: {
		namespaces: {
			list: ReturnType<typeof vi.fn>
			set: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		vi.clearAllMocks()

		mockClient = {
			namespaces: {
				list: vi.fn(),
				set: vi.fn().mockResolvedValue(undefined),
			},
		}
	})

	test("single namespace: auto-selects without prompts", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "myorg" }],
		})

		const result = await resolveNamespace(mockClient as unknown as Smithery)

		expect(result).toBe("myorg")
		expect(mockClient.namespaces.list).toHaveBeenCalledOnce()
		expect(promptForNamespaceSelection).not.toHaveBeenCalled()
		expect(promptForNamespaceCreation).not.toHaveBeenCalled()
		expect(mockClient.namespaces.set).not.toHaveBeenCalled()
	})

	test("multiple namespaces: prompts to select", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "org1" }, { name: "org2" }],
		})
		vi.mocked(promptForNamespaceSelection).mockResolvedValue("org2")

		const result = await resolveNamespace(mockClient as unknown as Smithery)

		expect(result).toBe("org2")
		expect(promptForNamespaceSelection).toHaveBeenCalledWith(["org1", "org2"])
		expect(promptForNamespaceCreation).not.toHaveBeenCalled()
		expect(mockClient.namespaces.set).not.toHaveBeenCalled()
	})

	test("no namespaces: prompts to create and creates namespace", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [],
		})
		vi.mocked(promptForNamespaceCreation).mockResolvedValue("neworg")

		const result = await resolveNamespace(mockClient as unknown as Smithery)

		expect(result).toBe("neworg")
		expect(promptForNamespaceCreation).toHaveBeenCalled()
		expect(mockClient.namespaces.set).toHaveBeenCalledWith("neworg")
		expect(promptForNamespaceSelection).not.toHaveBeenCalled()
	})

	test("handles API error on list", async () => {
		const apiError = new Error("Network error")
		mockClient.namespaces.list.mockRejectedValue(apiError)

		await expect(
			resolveNamespace(mockClient as unknown as Smithery),
		).rejects.toThrow()

		expect(createError).toHaveBeenCalledWith(
			apiError,
			"Failed to fetch namespaces",
		)
	})

	test("handles API error on create", async () => {
		mockClient.namespaces.list.mockResolvedValue({ namespaces: [] })
		vi.mocked(promptForNamespaceCreation).mockResolvedValue("neworg")
		const createError_instance = new Error("Permission denied")
		mockClient.namespaces.set.mockRejectedValue(createError_instance)

		await expect(
			resolveNamespace(mockClient as unknown as Smithery),
		).rejects.toThrow()

		expect(createError).toHaveBeenCalledWith(
			createError_instance,
			"Failed to create namespace",
		)
	})

	test("handles prompt error on creation", async () => {
		mockClient.namespaces.list.mockResolvedValue({ namespaces: [] })
		vi.mocked(promptForNamespaceCreation).mockRejectedValue(
			new Error("User cancelled"),
		)

		await expect(
			resolveNamespace(mockClient as unknown as Smithery),
		).rejects.toThrow("User cancelled")

		expect(mockClient.namespaces.set).not.toHaveBeenCalled()
	})

	test("handles prompt error on selection", async () => {
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: [{ name: "org1" }, { name: "org2" }],
		})
		vi.mocked(promptForNamespaceSelection).mockRejectedValue(
			new Error("User cancelled"),
		)

		await expect(
			resolveNamespace(mockClient as unknown as Smithery),
		).rejects.toThrow("User cancelled")
	})

	test("handles large namespace list", async () => {
		const manyNamespaces = Array.from({ length: 15 }, (_, i) => ({
			name: `org${i + 1}`,
		}))
		mockClient.namespaces.list.mockResolvedValue({
			namespaces: manyNamespaces,
		})
		vi.mocked(promptForNamespaceSelection).mockResolvedValue("org8")

		const result = await resolveNamespace(mockClient as unknown as Smithery)

		expect(result).toBe("org8")
		expect(promptForNamespaceSelection).toHaveBeenCalledWith(
			manyNamespaces.map((ns) => ns.name),
		)
	})
})
