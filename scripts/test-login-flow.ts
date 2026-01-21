/**
 * Quick test script to verify the login flow logic
 * Tests the flow against a local or staging server
 *
 * Usage:
 *   npx tsx scripts/test-login-flow.ts
 *   npx tsx scripts/test-login-flow.ts --endpoint http://localhost:3000
 */

import { executeCliAuthFlow } from "../src/lib/cli-auth.js"

async function main() {
	const args = process.argv.slice(2)
	let endpoint = "https://smithery.ai"

	const endpointIndex = args.indexOf("--endpoint")
	if (endpointIndex !== -1 && args[endpointIndex + 1]) {
		endpoint = args[endpointIndex + 1]
	}

	console.log(`Testing login flow against: ${endpoint}`)
	console.log()

	try {
		const apiKey = await executeCliAuthFlow({
			registryEndpoint: endpoint,
			// Optional: shorter timeout for testing
			// timeoutMs: 120000, // 2 minutes
		})

		console.log("\n=== Login Flow Test: SUCCESS ===")
		console.log(`Received API key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`)
		console.log(
			"\nNote: API key was not saved. Run 'smithery login' to save it.",
		)
	} catch (error) {
		console.error("\n=== Login Flow Test: FAILED ===")
		console.error(error instanceof Error ? error.message : String(error))
		process.exit(1)
	}
}

main()
