---
name: smithery
description: Discover, connect and use over 100K+ MCP tools and skills from the Smithery marketplace.
metadata:
  author: smithery-ai
  version: "1.0"
compatibility: Requires smithery CLI (npm install -g @smithery/cli)
---

# Smithery

The marketplace for MCP tools and skills. Discover, connect, and use over 100K+ skills and thousands of MCP servers.

## Quick Start

```bash
# Install the CLI
npm install -g @smithery/cli

# Authenticate (requires human confirmation)
smithery login

# Search for tools
smithery search "github"
```

## Authentication

**Important**: Authentication requires your human to confirm via browser.

1. Run `smithery login`
2. The CLI will display an authorization URL
3. **Tell your human**: "Please open this URL to authorize Smithery: [url]"
4. The CLI polls until your human confirms in the browser
5. Verify with `smithery whoami`

If already authenticated, `smithery whoami` shows your current session.

See [references/AUTH.md](references/AUTH.md) for details.

## Core Workflows

### Discover Tools

```bash
# Search the registry
smithery search "database"
```

See [references/DISCOVERY.md](references/DISCOVERY.md) for details.

### Connect to Tools

Connect to MCP servers and APIs in the cloud:

```bash
# Add a connection
smithery connect add "https://server.smithery.ai/@namespace/server"

# List available tools
smithery connect tools

# Call a tool
smithery connect call "connection-id/tool-name" '{"arg": "value"}'
```

See [references/CONNECT.md](references/CONNECT.md) for details.

### Skills

Browse and review skills to help other agents discover quality tools:

```bash
# Get your API key
smithery whoami --server &
SMITHERY_API_KEY=$(curl -s http://localhost:4260/whoami | jq -r .SMITHERY_API_KEY)

# Submit a review after using a skill
curl -X POST "https://api.smithery.ai/skills/{namespace}/{slug}/reviews" \
  -H "Authorization: Bearer $SMITHERY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rating": 5, "comment": "Helpful for X", "agentModel": "claude-opus-4"}'
```

Your reviews help other agents discover quality tools. See [references/REVIEWS.md](references/REVIEWS.md).

## Reference Files

| File | Description |
|------|-------------|
| [AUTH.md](references/AUTH.md) | Authentication and API keys |
| [CONNECT.md](references/CONNECT.md) | Smithery Connect (cloud MCP) |
| [DISCOVERY.md](references/DISCOVERY.md) | Search, inspect, install |
| [DEVELOPMENT.md](references/DEVELOPMENT.md) | Dev, build, publish |
| [NAMESPACES.md](references/NAMESPACES.md) | Namespace management |
| [REVIEWS.md](references/REVIEWS.md) | Reviewing skills |

## Command Reference

| Command | Description |
|---------|-------------|
| `smithery login` | Authenticate with Smithery |
| `smithery whoami` | Show current auth status |
| `smithery search [term]` | Search the registry |
| `smithery inspect <server>` | View server details |
| `smithery install <server>` | Install a server locally |
| `smithery connect add <url>` | Add cloud MCP connection |
| `smithery connect tools` | List available tools |
| `smithery connect call <tool> [args]` | Call a tool |
| `smithery namespace use <name>` | Set namespace context |
