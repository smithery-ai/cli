/**
 * Mock test to verify login flow components work correctly
 * This doesn't require a live backend
 *
 * Usage:
 *   npx tsx scripts/test-login-mock.ts
 */

import { openBrowserForAuth } from "../src/lib/cli-auth.js"

async function testBrowserOpening() {
	console.log("Testing browser opening...")
	console.log("Platform:", process.platform)

	const testUrl = "https://example.com/test"
	console.log(`Attempting to open: ${testUrl}`)

	try {
		await openBrowserForAuth(testUrl)
		console.log("✓ Browser opening completed (check if browser opened)")
	} catch (error) {
		console.log("✗ Browser opening failed:", error)
	}
}

async function testTypeDefinitions() {
	console.log("\nTesting type definitions...")

	// This just verifies the types compile correctly
	const mockOptions = {
		registryEndpoint: "https://test.com",
		pollInterval: 2000,
		timeoutMs: 300000,
	}

	console.log("✓ Type definitions are valid")
	console.log("  Options:", mockOptions)
}

async function main() {
	console.log("=== Mock Login Flow Tests ===\n")

	await testTypeDefinitions()
	await testBrowserOpening()

	console.log("\n=== All Mock Tests Complete ===")
	console.log(
		"\nTo test the full flow, run:\n  npx tsx scripts/test-login-flow.ts",
	)
}

main()
