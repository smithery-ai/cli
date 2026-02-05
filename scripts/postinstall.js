#!/usr/bin/env node

// Skip in CI environments
if (process.env.CI || process.env.SMITHERY_SUPPRESS_POSTINSTALL) {
	process.exit(0)
}

const line = "=".repeat(60)

console.log(`
${line}
  Smithery CLI installed!
${line}

Get started:
  smithery --help            Show all commands
  smithery servers search    Browse MCP servers
  smithery skills search     Browse skills

For agents: you should install the Smithery skill to learn how to use this CLI:
  smithery skills install smithery-ai/cli --agent <agent-name>

Explore 100K+ tools and skills at https://smithery.ai
${line}
`)
